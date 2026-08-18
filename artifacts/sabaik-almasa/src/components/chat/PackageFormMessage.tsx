import { ClipboardList, CheckCircle2, Loader2, Package, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useServiceRequest } from "@/context/ServiceRequestContext"
import { useGetContainers } from "@workspace/api-client-react"
import { getContainerValue } from "@/lib/packageOptions"
import { resolveServiceTypeFromContainer } from "@/components/home/packages/PackageCard"

interface PackageFormMessageProps {
  messageType?: string
  metadata?: string | null
  viewer: "client" | "admin"
  clientName?: string
  phone?: string
}

interface PackageFormMetadata {
  containerId?: number
  containerName?: string
  serviceType?: string
  conversationId?: number
}

interface OrderConfirmationMetadata {
  requestId?: number
}

function parseMetadata<T>(value?: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function PackageFormMessage({ messageType, metadata, viewer, clientName, phone }: PackageFormMessageProps) {
  const { openModal } = useServiceRequest()
  const { data: containers = [], isLoading } = useGetContainers()

  if (messageType === "order_confirmation") {
    const confirmation = parseMetadata<OrderConfirmationMetadata>(metadata)
    return (
      <div
        data-testid={`card-order-confirmation-${confirmation?.requestId ?? "unknown"}`}
        className="w-full rounded-2xl border border-green-200 bg-green-50 p-4 text-green-900"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckCircle2 size={19} />
          </span>
          <div>
            <p className="text-sm font-bold">تم تأكيد طلب الخدمة</p>
            {confirmation?.requestId && (
              <p data-testid={`text-chat-order-id-${confirmation.requestId}`} className="mt-1 text-xs text-green-700">
                رقم الطلب: <strong>#{confirmation.requestId}</strong>
              </p>
            )}
            <p className="mt-1 text-xs text-green-700">سيتواصل معك فريق الدعم لتأكيد التفاصيل.</p>
          </div>
        </div>
      </div>
    )
  }

  if (messageType !== "package_form") return null

  const formData = parseMetadata<PackageFormMetadata>(metadata)
  const containerId = Number(formData?.containerId)
  const container = containers.find((item) => item.id === containerId)
  const packageName = container?.name || formData?.containerName || "الباقة المختارة"
  const packageSize = container ? getContainerValue(container) : packageName
  const serviceType = formData?.serviceType || (container ? resolveServiceTypeFromContainer(container) : "")

  function openPackageForm() {
    if (!container || !serviceType) return
    openModal({
      serviceType,
      containerSize: packageSize,
      containerName: container.name,
      conversationId: formData?.conversationId,
      clientName,
      phone,
    })
  }

  return (
    <div
      data-testid={`card-package-form-${containerId || "unknown"}`}
      className="w-full overflow-hidden rounded-2xl border border-primary/15 bg-white shadow-sm"
    >
      <div className="flex items-start gap-3 border-b border-primary/10 bg-primary/5 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ClipboardList size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-primary">نموذج طلب الباقة</p>
          <p data-testid={`text-chat-package-name-${containerId || "unknown"}`} className="mt-1 truncate text-sm font-black text-gray-900">
            {packageName}
          </p>
          <p className="mt-1 text-xs text-gray-500">{container?.size || packageSize}</p>
        </div>
        <Package size={17} className="mr-auto shrink-0 text-secondary" />
      </div>

      <div className="space-y-3 p-4">
        <p className="text-xs leading-relaxed text-gray-600">
          راجع تفاصيل الباقة وأكمل الموقع والموعد وبيانات التواصل من نفس نموذج الطلب الموجود في الصفحة الرئيسية.
        </p>
        {viewer === "client" ? (
          <Button
            type="button"
            data-testid={`button-open-package-form-${containerId || "unknown"}`}
            onClick={openPackageForm}
            disabled={isLoading || !container || !serviceType}
            className="h-10 w-full gap-2 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary/90"
          >
            {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}
            {isLoading ? "جاري تحميل الباقة..." : "تأكيد البيانات أو تعديلها"}
          </Button>
        ) : (
          <div data-testid={`status-package-form-sent-${containerId || "unknown"}`} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
            <CheckCircle2 size={15} className="text-secondary" />
            أُرسل النموذج للعميل ليكمل الطلب
          </div>
        )}
      </div>
    </div>
  )
}