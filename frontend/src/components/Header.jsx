// import { useState } from "react";

// export default function Header({
//     setPage,
//     isAdmin,
//     logout,
//     theme,
//     setTheme,
// }) {
//     const [open, setOpen] = useState(false);

//     const btn =
//         "px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700";

//     return (
//         <header className="bg-white dark:bg-gray-800 shadow">
//             <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
//                 <h1 className="font-bold text-lg">💰 Budget App</h1>

//                 {/* Desktop */}
//                 <nav className="hidden md:flex gap-2">
//                     <button className={btn} onClick={() => setPage("venit")}>Venit</button>
//                     <button className={btn} onClick={() => setPage("cheltuieli")}>Cheltuieli</button>
//                     <button className={btn} onClick={() => setPage("grafice")}>Grafice</button>
//                     <button className={btn} onClick={() => setPage("economii")}>Vacanta</button>
//                     <button className={btn} onClick={() => setPage("economii-vacanta")}>Economii</button>
//                     <button className={btn} onClick={() => setPage("diagrama")}>Diagramă</button>
//                     <button onClick={() => setPage("fonduri")}>Fonduri</button>
//                     <button onClick={() => setPage("grafice-fonduri")}>📊 Grafice Fonduri</button>
//                     {isAdmin && (
//                         <button className={btn} onClick={() => setPage("admin")}>Admin</button>
//                     )}
//                 </nav>

//                 <div className="flex gap-2 items-center">
//                     <button
//                         onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
//                         className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700"
//                     >
//                         {theme === "dark" ? "☀️" : "🌙"}
//                     </button>

//                     <button onClick={logout} className="text-red-500">
//                         Logout
//                     </button>

//                     <button className="md:hidden" onClick={() => setOpen(!open)}>
//                         ☰
//                     </button>
//                 </div>
//             </div>

//             {/* Mobile menu */}
//             {open && (
//                 <div className="md:hidden px-4 pb-3 flex flex-col gap-2">
//                     <button onClick={() => setPage("venit")}>Venit</button>
//                     <button onClick={() => setPage("cheltuieli")}>Cheltuieli</button>
//                     <button onClick={() => setPage("grafice")}>Grafice</button>
//                     <button onClick={() => setPage("economii")}>Economii</button>
//                     <button onClick={() => setPage("economii-vacanta")}>🏖 Vacanță</button>
//                     <button onClick={() => setPage("diagrama")}>Diagramă</button>
//                     {isAdmin && <button onClick={() => setPage("admin")}>Admin</button>}
//                 </div>
//             )}
//         </header>
//     );
// }
