export default function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('ro-RO');
}
