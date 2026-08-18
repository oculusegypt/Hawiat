import { createContext, useContext, useState } from "react"

interface Preselect {
  serviceType?: string
  containerSize?: string
  containerName?: string
  conversationId?: number
  clientName?: string
  phone?: string
}

interface ServiceRequestContextType {
  isOpen: boolean
  preselect: Preselect
  openModal: (preselect?: Preselect) => void
  closeModal: () => void
}

const ServiceRequestContext = createContext<ServiceRequestContextType>({
  isOpen: false,
  preselect: {},
  openModal: () => {},
  closeModal: () => {},
})

export function ServiceRequestProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [preselect, setPreselect] = useState<Preselect>({})

  const openModal = (pre?: Preselect) => {
    setPreselect(pre || {})
    setIsOpen(true)
  }

  const closeModal = () => {
    setIsOpen(false)
    setPreselect({})
  }

  return (
    <ServiceRequestContext.Provider value={{ isOpen, preselect, openModal, closeModal }}>
      {children}
    </ServiceRequestContext.Provider>
  )
}

export function useServiceRequest() {
  return useContext(ServiceRequestContext)
}
