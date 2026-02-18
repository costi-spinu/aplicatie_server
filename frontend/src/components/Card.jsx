export default function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0 6px 20px rgba(0,0,0,0.05)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
