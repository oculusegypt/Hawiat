import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { motion, AnimatePresence } from "framer-motion"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  useSubmitServiceRequest,
  useUpdateServiceRequest,
  useGetContainers,
} from "@workspace/api-client-react"
import type { ServiceRequestUpdateStatus } from "@workspace/api-client-react"
import {
  Box, Truck, Layers, Sparkles, Wrench, Factory, Package, CheckCircle,
  type LucideIcon,
} from "lucide-react"

// ─── icon map (matches DB icon strings) ──────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  Box, Truck, Layers, Sparkles, Wrench, Factory, Package,
}
function ServiceIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Icon = ICON_MAP[name] ?? Package
  return <Icon size={size} />
}

// ─── helpers ──────────────────────────────────────────────────────────────────
/** Build the containerSize string from a container record (matches homepage style) */
function containerSizeString(name: string, size: string) {
  return size ? `${name} - ${size}` : name
}

const ADMIN_SERVICE_OPTIONS = [
  { title: "حاويات الأنقاض", icon: "Box", category: "debris" as const },
  { title: "حاويات النفايات", icon: "Package", category: "waste" as const },
  { title: "عقود النظافة", icon: "Sparkles", category: "contract" as const },
]

// ─── types ────────────────────────────────────────────────────────────────────
interface ServiceRequest {
  id: number
  clientName: string
  phone: string
  email?: string | null
  serviceType: string
  containerSize: string
  location: string
  duration?: string | null
  notes?: string | null
  appointmentType?: string | null
  scheduledAt?: string | null
  status: string
  adminNotes?: string | null
}

interface FormValues {
  clientName: string
  phone: string
  email: string
  serviceType: string
  containerSize: string
  location: string
  duration: string
  notes: string
  appointmentType: "immediate" | "scheduled"
  scheduledAt: string
  status: string
  adminNotes: string
}

interface Props {
  open: boolean
  onClose: () => void
  request?: ServiceRequest | null
  onSuccess?: () => void
}

// ─── component ────────────────────────────────────────────────────────────────
export default function RequestFormModal({ open, onClose, request, onSuccess }: Props) {
  const isEdit = !!request

  const { data: containers = [] } = useGetContainers()

  const { register, handleSubmit, setValue, watch, reset, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      clientName: "", phone: "", email: "", serviceType: "", containerSize: "",
      location: "", duration: "", notes: "", appointmentType: "immediate",
      scheduledAt: "", status: "pending", adminNotes: "",
    },
  })

  useEffect(() => {
    if (request) {
      reset({
        clientName:      request.clientName ?? "",
        phone:           request.phone ?? "",
        email:           request.email ?? "",
        serviceType:     request.serviceType ?? "",
        containerSize:   request.containerSize ?? "",
        location:        request.location ?? "",
        duration:        request.duration ?? "",
        notes:           request.notes ?? "",
        appointmentType: request.appointmentType === "scheduled" ? "scheduled" : "immediate",
        scheduledAt:     request.scheduledAt ?? "",
        status:          request.status ?? "pending",
        adminNotes:      request.adminNotes ?? "",
      })
    } else {
      reset({
        clientName: "", phone: "", email: "", serviceType: "", containerSize: "",
        location: "", duration: "", notes: "", appointmentType: "immediate",
        scheduledAt: "", status: "pending", adminNotes: "",
      })
    }
  }, [request, open, reset])

  const { mutate: create } = useSubmitServiceRequest()
  const { mutate: update } = useUpdateServiceRequest()

  const serviceType     = watch("serviceType")
  const containerSize   = watch("containerSize")
  const appointmentType = watch("appointmentType")

  const selectedService = ADMIN_SERVICE_OPTIONS.find((service) => service.title === serviceType)
  const showContainerPicker = !!selectedService?.category

  // Active container list, sorted. The admin order form intentionally uses
  // only the three supported service types, independent of public services.
  const activeContainers = containers.filter(c => c.isActive).sort((a, b) => a.order - b.order)
  const serviceContainers = selectedService?.category
    ? activeContainers.filter((container) => container.category === selectedService.category)
    : []

  const onSubmit = (values: FormValues) => {
    const shared = {
      clientName:      values.clientName,
      phone:           values.phone,
      email:           values.email || null,
      serviceType:     values.serviceType,
      containerSize:   selectedService?.category ? values.containerSize || null : "غير محدد",
      location:        values.location,
      duration:        values.duration || null,
      notes:           values.notes || null,
      appointmentType: values.appointmentType,
      scheduledAt:     values.appointmentType === "scheduled" ? values.scheduledAt || null : null,
    }
    if (isEdit && request) {
      update(
        { id: request.id, data: { ...shared, status: values.status as ServiceRequestUpdateStatus, adminNotes: values.adminNotes || null } },
        { onSuccess: () => { onSuccess?.(); onClose() } }
      )
    } else {
      create(
        { data: shared },
        { onSuccess: () => { onSuccess?.(); onClose() } }
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEdit ? `تعديل الطلب #${request?.id}` : "إنشاء طلب جديد"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-1">

          {/* ══ 1. SERVICE TYPE ══════════════════════════════════════════════════ */}
          <div>
            <Label className="text-sm font-semibold text-gray-800 mb-2 block">
              نوع الخدمة <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
               {ADMIN_SERVICE_OPTIONS.map(s => {
                const selected = serviceType === s.title
                return (
                  <motion.button
                     key={s.title}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setValue("serviceType", s.title, { shouldValidate: true })
                      // clear container when service changes
                       if (!s.category) setValue("containerSize", "")
                    }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all ${
                      selected
                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                        : "border-gray-200 bg-white hover:border-primary/30 hover:shadow-sm"
                    }`}
                  >
                    <span className={selected ? "text-primary" : "text-gray-500"}>
                       <ServiceIcon name={s.icon} size={22} />
                    </span>
                    <span className={`text-xs font-bold leading-tight ${selected ? "text-primary" : "text-gray-800"}`}>
                      {s.title}
                    </span>
                    {selected && (
                      <span className="absolute top-1.5 left-1.5">
                        <CheckCircle size={14} className="text-primary" />
                      </span>
                    )}
                  </motion.button>
                )
              })}
            </div>
            {/* hidden input so RHF validation works */}
            <input type="hidden" {...register("serviceType", { required: true })} />
          </div>

          {/* ══ 2. CONTAINER SIZE (only when relevant) ═══════════════════════════ */}
          <AnimatePresence>
            {showContainerPicker && (
              <motion.div
                key="containers"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <Label className="text-sm font-semibold text-gray-800 mb-2 block">
                  حجم ومقاس الحاوية <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                   {serviceContainers.map(c => {
                    const val = containerSizeString(c.name, c.size)
                    const selected = containerSize === val
                    return (
                      <motion.button
                        key={c.id}
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setValue("containerSize", val, { shouldValidate: true })}
                        className={`flex flex-col rounded-xl border-2 overflow-hidden text-right transition-all ${
                          selected
                            ? "border-primary shadow-md ring-2 ring-primary/20"
                            : "border-gray-100 bg-white hover:border-primary/40"
                        }`}
                      >
                        {/* image */}
                        <div className="h-16 overflow-hidden bg-gray-100 relative">
                          <img
                            src={c.imageUrl}
                            alt={c.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
                          />
                          {selected && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <CheckCircle size={22} className="text-primary drop-shadow" />
                            </div>
                          )}
                        </div>
                        {/* info */}
                        <div className="p-2">
                          <p className="font-bold text-xs text-gray-900">{c.name}</p>
                          <p className="text-[10px] text-gray-500">{c.size}</p>
                          <p className="text-primary font-black text-xs mt-0.5">{c.pricePerDay} ر/يوم</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{c.capacity}</p>
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
                 <input type="hidden" {...register("containerSize", { required: true })} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ══ 3. CLIENT INFO ══════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="اسم العميل *">
              <Input {...register("clientName", { required: true })} placeholder="محمد عبدالله" />
            </Field>
            <Field label="رقم الهاتف *">
              <Input {...register("phone", { required: true })} placeholder="05XXXXXXXX" dir="ltr" />
            </Field>
          </div>

          <Field label="البريد الإلكتروني">
            <Input {...register("email")} placeholder="example@email.com" dir="ltr" />
          </Field>

          {/* ══ 4. DURATION + LOCATION ══════════════════════════════════════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="موقع المشروع *">
              <Input {...register("location", { required: true })} placeholder="الرياض - حي النزهة" />
            </Field>
            <Field label="مدة الاستئجار">
              <Input {...register("duration")} placeholder="أسبوع / يومان..." />
            </Field>
          </div>

          {/* ══ 5. APPOINTMENT ══════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="نوع الموعد">
              <Select
                value={appointmentType}
                onValueChange={(v) => setValue("appointmentType", v as "immediate" | "scheduled")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">فوري</SelectItem>
                  <SelectItem value="scheduled">موعد محدد</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {appointmentType === "scheduled" && (
              <Field label="تاريخ ووقت الموعد">
                <Input {...register("scheduledAt")} type="datetime-local" />
              </Field>
            )}
          </div>

          <Field label="ملاحظات العميل">
            <Textarea {...register("notes")} placeholder="أي تفاصيل إضافية..." rows={2} />
          </Field>

          {/* ══ 6. ADMIN FIELDS (edit only) ══════════════════════════════════════ */}
          {isEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t">
              <Field label="الحالة">
                <Select
                  value={watch("status")}
                  onValueChange={(v) => setValue("status", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">جديد</SelectItem>
                    <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                    <SelectItem value="completed">مكتمل</SelectItem>
                    <SelectItem value="cancelled">ملغي</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="ملاحظات الإدارة">
                <Textarea {...register("adminNotes")} placeholder="ملاحظات داخلية..." rows={2} />
              </Field>
            </div>
          )}

          <DialogFooter className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
            <Button
              type="submit"
              disabled={isSubmitting || !serviceType || !!(showContainerPicker && !containerSize)}
            >
              {isEdit ? "حفظ التعديلات" : "إنشاء الطلب"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── sub-components ───────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      {children}
    </div>
  )
}
