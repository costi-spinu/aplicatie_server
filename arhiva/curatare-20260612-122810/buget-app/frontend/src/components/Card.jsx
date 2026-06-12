export default function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #cfd8d3",
        borderRadius: 6,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
