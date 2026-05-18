import { NavLink } from 'react-router-dom';
import { Book, Code, Terminal, FileJson, Info, Zap, Shield, Workflow } from 'lucide-react';

const DocumentationLayout = ({ children }) => {
  const sections = [
    {
      title: 'Getting Started',
      links: [
        { name: 'Overview', path: '/docs/overview', icon: Info },
        { name: 'Quick Start', path: '/docs/quickstart', icon: Zap },
        { name: 'Installation', path: '/docs/installation', icon: Terminal },
      ]
    },
    {
      title: 'Developer Guide',
      links: [
        { name: 'Core Concepts', path: '/docs/concepts', icon: Book },
        { name: 'API Reference', path: '/docs/api-reference', icon: Code },
        { name: 'Worker Architecture', path: '/docs/architecture', icon: Workflow },
      ]
    },
    {
      title: 'MCP Protocol',
      links: [
        { name: 'Protocol Spec', path: '/docs/protocol-spec', icon: FileJson },
        { name: 'Auth & Security', path: '/docs/security', icon: Shield },
      ]
    }
  ];

  return (
    <div className="flex min-h-[calc(100vh-80px)] bg-zinc-950 text-zinc-100">
      {/* Docs Sidebar - High Density */}
      <aside className="w-72 border-r border-zinc-800 bg-zinc-950 hidden lg:block sticky top-20 h-[calc(100vh-80px)] overflow-y-auto custom-scrollbar">
        <div className="p-8 pt-12">
          {/* Logo removed to prevent overlap with Navbar */}

          <nav className="space-y-10">
            {sections.map((section) => (
              <div key={section.title}>
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 ml-3">{section.title}</h4>
                <ul className="space-y-1">
                  {section.links.map((link) => (
                    <li key={link.path}>
                      <NavLink
                        to={link.path}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                            isActive
                              ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700'
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                          }`
                        }
                      >
                        <link.icon size={16} className="text-zinc-500" />
                        {link.name}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* Docs Content - Dark Mode Optimized */}
      <main className="flex-1 p-8 md:p-16 lg:p-24 overflow-y-auto">
        <div className="max-w-3xl mx-auto prose prose-invert prose-zinc prose-headings:font-bold prose-headings:tracking-tighter prose-a:text-brand-primary prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 prose-code:text-brand-primary prose-code:bg-zinc-900 prose-code:px-1 prose-code:rounded prose-img:rounded-2xl">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DocumentationLayout;