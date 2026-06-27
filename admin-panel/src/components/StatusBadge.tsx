interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const isActive = status === 'active';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isActive
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          isActive ? 'bg-green-500' : 'bg-red-500'
        }`}
        aria-hidden="true"
      />
      {isActive ? 'Active' : 'Disabled'}
    </span>
  );
}
