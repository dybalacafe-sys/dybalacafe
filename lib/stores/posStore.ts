import { create } from 'zustand'

export interface PosCartItem {
  id: number
  name: string
  price: number
  stock: number
  unit: string
  category?: { name: string }
  quantity: number
  subtotal: number
}

interface PosState {
  cart: PosCartItem[]
  discount: number
  paymentMethod: string
  customerPhone: string
  customerName: string
  setCart: (updater: PosCartItem[] | ((prev: PosCartItem[]) => PosCartItem[])) => void
  setDiscount: (discount: number) => void
  setPaymentMethod: (paymentMethod: string) => void
  setCustomerPhone: (phone: string) => void
  setCustomerName: (name: string) => void
  resetCheckout: () => void
}

export const usePosStore = create<PosState>((set) => ({
  cart: [],
  discount: 0,
  paymentMethod: 'cash',
  customerPhone: '',
  customerName: '',
  setCart: (updater) =>
    set((state) => ({
      cart: typeof updater === 'function' ? updater(state.cart) : updater,
    })),
  setDiscount: (discount) => set({ discount }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setCustomerPhone: (customerPhone) => set({ customerPhone }),
  setCustomerName: (customerName) => set({ customerName }),
  resetCheckout: () =>
    set({
      cart: [],
      discount: 0,
      customerPhone: '',
      customerName: '',
    }),
}))
