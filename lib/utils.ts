import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getTransactionStatusLabel(status: string) {
  switch (status) {
    case 'request_sent': return 'リクエスト送信済';
    case 'approved': return '予約・調整中'; // "Approved" -> Waiting for Payment/Adjusting
    case 'payment_pending': return '受渡待ち'; // "Payment Pending" -> Waiting for Handover
    case 'completed': return '取引完了';
    case 'cancelled': return 'キャンセル';
    default: return status;
  }
}
