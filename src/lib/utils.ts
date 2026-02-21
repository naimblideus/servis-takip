export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatDateShort(date: Date | string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    NEW: 'Yeni',
    IN_SERVICE: 'Serviste',
    WAITING_FOR_PART: 'Parça Bkl.',
    READY: 'Hazır',
    DELIVERED: 'Teslim',
    CANCELLED: 'İptal',
  };
  return labels[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    NEW: 'bg-yellow-100 text-yellow-800',
    IN_SERVICE: 'bg-blue-100 text-blue-800',
    WAITING_FOR_PART: 'bg-orange-100 text-orange-800',
    READY: 'bg-green-100 text-green-800',
    DELIVERED: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}


export function getPaymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    UNPAID: 'Ödenmedi',
    PARTIAL: 'Kısmi Ödeme',
    PAID: 'Ödendi',
  };
  return labels[status] || status;
}

export function getPaymentStatusColor(status: string): string {
  const colors: Record<string, string> = {
    UNPAID: 'bg-red-100 text-red-800',
    PARTIAL: 'bg-yellow-100 text-yellow-800',
    PAID: 'bg-green-100 text-green-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function generateTicketNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `SF-${year}-${random}`;
}

export function cn(...classes: string[]): string {
  return classes.filter(Boolean).join(' ');
}