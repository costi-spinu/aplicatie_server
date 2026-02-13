export default function PrivateRoute({ children }) {
    const token = localStorage.getItem("access");
    return token ? children : null;
}
