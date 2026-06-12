export default function Header({ title = "Buget & Economii" }) {
  return (
    <header style={styles.header}>
      <div style={styles.title}>{title}</div>
    </header>
  );
}

const styles = {
  header: {
    background: "#ffffff",
    borderBottom: "1px solid #cfd8d3",
    padding: "12px 20px",
  },
  title: {
    color: "#10201a",
    fontWeight: 800,
    fontSize: 18,
  },
};
