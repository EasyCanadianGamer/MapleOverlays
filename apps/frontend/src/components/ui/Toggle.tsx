interface ToggleProps {
  on: boolean;
  onChange?: (value: boolean) => void;
}

export default function Toggle({ on, onChange }: ToggleProps) {
  return (
    <button
      onClick={() => onChange?.(! on)}
      style={{
        width: 40,
        height: 22,
        padding: 0,
        border: 0,
        cursor: 'pointer',
        borderRadius: 999,
        position: 'relative',
        background: on ? 'var(--maple-500)' : 'var(--bg-4)',
        transition: 'background .15s ease',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: 999,
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,.4)',
          transition: 'left .15s var(--ease-out)',
        }}
      />
    </button>
  );
}
