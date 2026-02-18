export default function Button({ children, ...props }) {
  return (
    <button
      {...props}
      style={{
        border: 'none',
        borderRadius: '12px',
        padding: '10px 14px',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
