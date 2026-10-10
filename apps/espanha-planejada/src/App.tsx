import { BookOpen, Settings as SettingsIcon, Users } from 'lucide-react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { cx } from './components/ui';
import ClientsPage from './pages/ClientsPage';
import ClientWorkspace from './pages/ClientWorkspace';
import MethodologyPage from './pages/MethodologyPage';
import PlanView from './pages/PlanView';
import ReportPage from './pages/ReportPage';
import SettingsPage from './pages/SettingsPage';

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" fill={light ? '#ffffff' : '#182a47'} />
        <path d="M8 21l5-6 4 4 7-9" fill="none" stroke="#3db480" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="leading-tight">
        <p className={cx('text-sm font-bold tracking-tight', light ? 'text-white' : 'text-navy-900')}>Espanha Planejada</p>
        <p className={cx('text-[11px]', light ? 'text-navy-200' : 'text-navy-500')}>Planejamento financeiro de mudança</p>
      </div>
    </div>
  );
}

const NAV = [
  { to: '/', label: 'Clientes', icon: Users, end: true },
  { to: '/metodologia', label: 'Metodologia', icon: BookOpen, end: false },
  { to: '/configuracoes', label: 'Configurações', icon: SettingsIcon, end: false },
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print hidden w-60 shrink-0 flex-col bg-navy-900 px-4 py-6 lg:flex">
        <Logo light />
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-navy-700 text-white' : 'text-navy-200 hover:bg-navy-800 hover:text-white',
                )
              }
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-lg bg-navy-800 p-3 text-[11px] leading-relaxed text-navy-200">
          Área do consultor. Dados salvos somente neste navegador — exporte backups com frequência.
        </div>
      </aside>
      <header className="no-print sticky top-0 z-30 border-b border-areia-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx('flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium', isActive ? 'bg-navy-800 text-white' : 'bg-areia-100 text-navy-700')
              }
            >
              <n.icon className="h-3.5 w-3.5" />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  // Relatório e visão do cliente têm layout próprio (sem menu do consultor).
  const standalone = location.pathname.endsWith('/relatorio') || location.pathname.startsWith('/plano/');
  const routes = (
    <Routes>
      <Route path="/" element={<ClientsPage />} />
      <Route path="/clientes/:id" element={<ClientWorkspace />} />
      <Route path="/clientes/:id/relatorio" element={<ReportPage />} />
      <Route path="/plano/:id" element={<PlanView />} />
      <Route path="/configuracoes" element={<SettingsPage />} />
      <Route path="/metodologia" element={<MethodologyPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
  return standalone ? routes : <Shell>{routes}</Shell>;
}
