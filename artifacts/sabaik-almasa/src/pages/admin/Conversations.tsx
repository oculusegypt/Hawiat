import { useState, useRef, useEffect } from "react"
import { useGetConversations, useGetMessages, useSendMessage, useUpdateConversation, useGetContainers } from "@workspace/api-client-react"
import { MessageSenderType, MessageInputSenderType, MessageInputMessageType, ConversationUpdateStatus } from "@workspace/api-client-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, User, CheckCircle2, Clock, MessageSquare, Trash2, AlertTriangle, Package, MapPin } from "lucide-react"
import { FaWhatsapp } from "react-icons/fa"
import { useToast } from "@/hooks/use-toast"
import { useSiteSettings } from "@/context/SiteSettingsContext"
import { PackageFormMessage } from "@/components/chat/PackageFormMessage"
import { getContainerValue } from "@/lib/packageOptions"
import { resolveServiceTypeFromContainer } from "@/components/home/packages/PackageCard"

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || ""

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "")
  if (digits.startsWith("00966")) return `0${digits.slice(5)}`
  if (digits.startsWith("966")) return `0${digits.slice(3)}`
  return digits
}

function isConfiguredWhatsappNumber(phone: string, whatsappPhone: string) {
  const customerPhone = normalizePhone(phone)
  const configuredPhone = normalizePhone(whatsappPhone)
  return Boolean(customerPhone && configuredPhone) &&
    (customerPhone === configuredPhone || customerPhone.slice(-9) === configuredPhone.slice(-9))
}

function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, "")
  const international = digits.startsWith("00") ? digits.slice(2) : digits.startsWith("0") ? `966${digits.slice(1)}` : digits
  return `https://wa.me/${international}`
}

export default function AdminConversations() {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [reply, setReply] = useState("")
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const { phoneWhatsapp } = useSiteSettings()

  const { data: conversations, refetch: refetchConvs } = useGetConversations()
  const { data: containers = [] } = useGetContainers()
  const activeConversations = conversations?.filter(conversation => conversation.status !== "closed") ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messages, refetch: refetchMsgs } = useGetMessages(selectedId as number, {
    query: { enabled: !!selectedId, refetchInterval: 3000 } as any,
  })

  const { mutate: sendMsg } = useSendMessage()
  const { mutate: updateConv } = useUpdateConversation()
  const selectedConversation = conversations?.find(conversation => conversation.id === selectedId)
  const activePackages = containers.filter(container => container.isActive).sort((a, b) => a.order - b.order)
  const selectedIsWhatsapp = selectedConversation
    ? isConfiguredWhatsappNumber(selectedConversation.phone, phoneWhatsapp)
    : false

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView()
  }, [messages])

  useEffect(() => {
    const openId = Number(new URLSearchParams(window.location.search).get("open"))
    if (openId && activeConversations.some(conversation => conversation.id === openId)) {
      setSelectedId(openId)
    }
  }, [activeConversations])

  useEffect(() => {
    if (selectedId && conversations && !activeConversations.some(conversation => conversation.id === selectedId)) {
      setSelectedId(null)
    }
  }, [activeConversations, conversations, selectedId])

  useEffect(() => {
    setSelectedPackageId(selectedConversation?.packageId ? String(selectedConversation.packageId) : "")
  }, [selectedConversation?.packageId, selectedId])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reply.trim() || !selectedId) return
    sendMsg({ id: selectedId!, data: { content: reply, senderType: MessageInputSenderType.admin } }, {
      onSuccess: () => { setReply(""); refetchMsgs(); refetchConvs() }
    })
  }

  const handleSendPackageForm = () => {
    if (!selectedId || !selectedPackageId) return
    const selectedPackage = activePackages.find(packageItem => String(packageItem.id) === selectedPackageId)
    if (!selectedPackage) return
    const serviceType = resolveServiceTypeFromContainer(selectedPackage)
    sendMsg({
      id: selectedId,
      data: {
        content: `نموذج طلب الباقة: ${selectedPackage.name}`,
        senderType: MessageInputSenderType.admin,
        messageType: MessageInputMessageType.package_form,
        metadata: JSON.stringify({
          containerId: selectedPackage.id,
          containerName: selectedPackage.name,
          serviceType,
          conversationId: selectedId,
        }),
      },
    }, {
      onSuccess: () => {
        refetchMsgs()
        refetchConvs()
        toast({ title: "تم إرسال نموذج الباقة للعميل" })
      },
      onError: () => toast({ variant: "destructive", title: "تعذر إرسال نموذج الباقة" }),
    })
  }

  const handleClose = () => {
    if (!selectedId) return
    updateConv({ id: selectedId, data: { status: ConversationUpdateStatus.closed } }, {
      onSuccess: () => { refetchConvs(); setSelectedId(null) }
    })
  }

  async function handleDelete(id: number) {
    setDeletingId(id)
    try {
      const res = await fetch(`${API_BASE}/api/admin/conversations/${id}`, {
        method: "DELETE",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
          "Cache-Control": "no-cache",
        },
      })
      if (!res.ok) throw new Error("فشل الحذف")
      if (selectedId === id) setSelectedId(null)
      const refreshed = await refetchConvs()
      if (refreshed.data?.some(conversation => conversation.id === id)) {
        throw new Error("لم تختفِ المحادثة من القائمة بعد الحذف")
      }
      toast({ title: "تم حذف المحادثة ✅" })
    } catch {
      toast({ variant: "destructive", title: "فشل الحذف" })
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeleteAll() {
    setDeletingAll(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/conversations`, {
        method: "DELETE",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
          "Cache-Control": "no-cache",
        },
      })
      if (!res.ok) throw new Error("فشل الحذف")
      setSelectedId(null)
      setConfirmDeleteAll(false)
      const refreshed = await refetchConvs()
      if ((refreshed.data?.length ?? 0) > 0) {
        throw new Error("لم تختفِ المحادثات من القائمة بعد الحذف")
      }
      toast({ title: "تم حذف جميع المحادثات ✅" })
    } catch {
      toast({ variant: "destructive", title: "فشل الحذف" })
    } finally {
      setDeletingAll(false)
    }
  }

  return (
    <div className="min-h-[calc(100dvh-8rem)] lg:h-[calc(100vh-8rem)] flex gap-4 lg:gap-6 flex-col">

      {/* Delete All confirmation banner */}
      {confirmDeleteAll && (
        <div className="flex flex-wrap items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <p className="flex-1 text-red-700 font-medium">هل أنت متأكد من حذف جميع المحادثات والرسائل؟ لا يمكن التراجع.</p>
          <Button size="sm" variant="destructive" onClick={handleDeleteAll} disabled={deletingAll} className="rounded-xl">
            {deletingAll ? "جارٍ الحذف..." : "نعم، احذف الكل"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfirmDeleteAll(false)} className="rounded-xl">إلغاء</Button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 flex-col gap-4 lg:flex-row lg:gap-6">
        {/* List */}
        <Card className="flex h-64 w-full shrink-0 flex-col overflow-hidden lg:h-auto lg:w-1/3">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
            <span className="font-bold text-lg text-primary">المحادثات النشطة</span>
            {conversations && conversations.length > 0 && (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                title="حذف الكل"
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {activeConversations.map(conv => (
              <div key={conv.id} className={`group relative border-b transition-colors ${
                selectedId === conv.id ? "bg-primary/5 border-l-4 border-l-primary" : "hover:bg-gray-50"
              }`}>
                <button
                  onClick={() => setSelectedId(conv.id)}
                  className="w-full text-right p-4 pr-3"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-gray-900">{conv.clientName}</span>
                    {conv.status === "open" && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1" />}
                  </div>
                  <div className="mb-1 flex items-center gap-1 text-xs text-gray-500" dir="ltr">
                    <span>{conv.phone}</span>
                    {isConfiguredWhatsappNumber(conv.phone, phoneWhatsapp) && (
                      <FaWhatsapp
                        size={14}
                        className="text-green-500"
                        title="هذا الرقم محدد للواتساب في إعدادات الموقع"
                        aria-label="رقم واتساب"
                      />
                    )}
                  </div>
                   {conv.packageName && (
                     <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-primary">
                       <Package size={12} />
                       <span className="truncate">{conv.packageName}</span>
                     </div>
                   )}
                  <p className="text-sm text-gray-600 truncate">{conv.lastMessage || "محادثة جديدة"}</p>
                </button>
                {/* Delete button — appears on hover */}
                <button
                  onClick={() => handleDelete(conv.id)}
                  disabled={deletingId === conv.id}
                  title="حذف المحادثة"
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                >
                  {deletingId === conv.id
                    ? <span className="text-xs text-red-400">...</span>
                    : <Trash2 size={13} />}
                </button>
              </div>
            ))}
            {activeConversations.length === 0 && (
              <div className="p-8 text-center text-gray-500">لا توجد محادثات نشطة</div>
            )}
          </div>
        </Card>

        {/* Chat Area */}
        <Card className="flex min-h-[28rem] w-full min-w-0 flex-col overflow-hidden bg-gray-50/50 lg:min-h-0 lg:w-2/3">
          {selectedId ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold">المحادثة #{selectedId}</h3>
                    {selectedConversation?.phone && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500" dir="ltr">
                        <span>{selectedConversation.phone}</span>
                        {selectedIsWhatsapp && (
                          <a
                            href={whatsappHref(selectedConversation.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-500 transition-colors hover:text-green-600"
                            title="فتح محادثة واتساب"
                            aria-label="فتح محادثة واتساب"
                          >
                            <FaWhatsapp size={16} />
                          </a>
                        )}
                      </div>
                    )}
                     {selectedConversation?.packageName && (
                       <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-primary">
                         <Package size={12} />
                         الباقة: {selectedConversation.packageName}
                       </p>
                     )}
                    <p className="text-xs text-green-600">متصل الآن</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(selectedId)}
                    disabled={deletingId === selectedId}
                    className="text-red-500 border-red-200 hover:bg-red-50 gap-1.5"
                  >
                    <Trash2 size={14} />
                    {deletingId === selectedId ? "جارٍ الحذف..." : "حذف"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleClose} className="text-gray-600">
                    <CheckCircle2 size={16} className="mr-2" /> إغلاق
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages?.map(msg => {
                  const isAdmin = msg.senderType === MessageSenderType.admin || msg.senderType === MessageSenderType.ai
                   const isStructured = msg.messageType === "package_form" || msg.messageType === "order_confirmation"
                   if (isStructured) {
                     return (
                       <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                         <div className="max-w-[88%]">
                           <PackageFormMessage messageType={msg.messageType} metadata={msg.metadata} viewer="admin" />
                         </div>
                       </div>
                     )
                   }
                  return (
                    <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${
                        isAdmin
                          ? "bg-primary text-white rounded-tr-sm"
                          : "bg-white border shadow-sm text-gray-800 rounded-tl-sm"
                      }`}>
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        {msg.attachmentUrl && (
                          <a
                            href={msg.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 block overflow-hidden rounded-xl border border-black/10 bg-black/5"
                            title="فتح الصورة بالحجم الكامل"
                          >
                            <img
                              src={msg.attachmentUrl}
                              alt="صورة مرفقة من العميل"
                              className="max-h-64 w-full object-contain"
                            />
                          </a>
                        )}
                        {(msg.locationLabel || (msg.locationLat && msg.locationLng)) && (
                          <a
                            href={msg.locationLabel?.startsWith("http")
                              ? msg.locationLabel
                              : `https://www.google.com/maps?q=${msg.locationLat},${msg.locationLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold underline ${
                              isAdmin ? "bg-white/10 text-white" : "bg-primary/5 text-primary"
                            }`}
                          >
                            <MapPin size={14} />
                            فتح الموقع المرسل
                          </a>
                        )}
                        {msg.senderType === MessageSenderType.ai && (
                          <div className="text-[10px] text-white/50 mt-1 flex items-center gap-1">
                            <Clock size={10} /> رد آلي
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t bg-white px-4 pt-3">
                <div className="flex flex-col gap-2 rounded-xl border border-primary/10 bg-primary/5 p-2 sm:flex-row">
                  <select
                    data-testid="select-conversation-package-form"
                    value={selectedPackageId}
                    onChange={event => setSelectedPackageId(event.target.value)}
                    className="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-xs outline-none focus:border-primary/40"
                  >
                    <option value="">اختر باقة لإرسال نموذجها للعميل</option>
                    {activePackages.map(packageItem => (
                      <option key={packageItem.id} value={packageItem.id}>
                        {packageItem.name}{packageItem.size ? ` — ${packageItem.size}` : ""}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    data-testid="button-send-package-form"
                    onClick={handleSendPackageForm}
                    disabled={!selectedPackageId}
                    className="h-10 shrink-0 gap-1.5 rounded-lg bg-secondary px-4 text-xs font-bold text-white hover:bg-secondary/90"
                  >
                    <Package size={14} />
                    إرسال نموذج الباقة
                  </Button>
                </div>
              </div>
              <form onSubmit={handleSend} className="flex gap-2 border-t bg-white p-4">
                <Input
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="اكتب ردك هنا..."
                  className="flex-1 bg-gray-50 focus-visible:ring-primary"
                />
                <Button type="submit" className="bg-primary text-white shrink-0 px-6">
                  إرسال <Send size={16} className="mr-2 rtl:-scale-x-100" />
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
                <p>اختر محادثة لعرض التفاصيل</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
