export default function Header({ title = 'Budget App' }) {
  return (
    <header style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb' }}>
      <h1 style={{ margin: 0, fontSize: '20px' }}>{title}</h1>
    </header>
  );
}
