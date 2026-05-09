import { RadioIcon, Cog6ToothIcon, BookOpenIcon } from "@heroicons/react/24/solid";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { SettingsPage } from "./pages/SettingsPage";
import { WikiPage } from "./pages/WikiPage";
import DesktopApp from "./DesktopApp";

export default function App() {
  const location = useLocation();
  
  // 🖥️ 桌面版独立界面 - 访问 /desktop
  if (location.pathname === '/desktop') {
    return <DesktopApp />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(106,227,255,0.12),_transparent_35%),linear-gradient(180deg,_#07080d_0%,_#0c1018_45%,_#07080d_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 rounded-[32px] border border-white/10 bg-black/20 px-6 py-5 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-coral to-pulse p-3 text-slate-950">
              <RadioIcon className="h-7 w-7" />
            </div>
            <div>
              <p className="font-display text-2xl font-bold">Lobster Radio</p>
              <p className="text-sm text-mist">Adaptive music, voiced by AI.</p>
            </div>
          </div>
          <nav className="flex items-center gap-3">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-semibold transition ${isActive ? "bg-white text-slate-950" : "border border-white/10 text-white hover:bg-white/10"}`
              }
            >
              Station
            </NavLink>
            <NavLink
              to="/wiki"
              className={({ isActive }) =>
                `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive ? "bg-white text-slate-950" : "border border-white/10 text-white hover:bg-white/10"
                }`
              }
            >
              <BookOpenIcon className="h-4 w-4" />
              Wiki
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive ? "bg-white text-slate-950" : "border border-white/10 text-white hover:bg-white/10"
                }`
              }
            >
              <Cog6ToothIcon className="h-4 w-4" />
              Settings
            </NavLink>
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/wiki" element={<WikiPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </div>
  );
}
