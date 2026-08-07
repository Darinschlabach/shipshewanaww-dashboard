"use client";



import { useEffect, useState } from "react";

import Link from "next/link";

import { usePathname, useRouter } from "next/navigation";

import {

  IconLayoutDashboard,

  IconUsers,

  IconBriefcase,

  IconAddressBook,

  IconTool,

  IconShoppingCart,

  IconCalendar,

  IconFileInvoice,

  IconFiles,

  IconBook,

  IconSettings,

  IconPlugConnected,

  IconLogout,

  IconChevronDown,

} from "@tabler/icons-react";

import { createClient } from "@/lib/supabase/client";

import { getInitialsFromName } from "@/lib/utils";



type NavLink = {

  type: "link";

  href: string;

  label: string;

  icon: typeof IconLayoutDashboard;

};



type NavGroup = {

  type: "group";

  label: string;

  icon: typeof IconBook;

  children: { href: string; label: string }[];

};



type NavItem = NavLink | NavGroup;



const navSections: { label: string; items: NavItem[] }[] = [

  {

    label: "MAIN",

    items: [

      { type: "link", href: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard },

      { type: "link", href: "/leads", label: "Quotes", icon: IconUsers },

      { type: "link", href: "/jobs", label: "Jobs", icon: IconBriefcase },

      { type: "link", href: "/invoices", label: "Invoices", icon: IconFileInvoice },

      { type: "link", href: "/contacts", label: "Contacts", icon: IconAddressBook },

      { type: "link", href: "/files", label: "Files", icon: IconFiles },

    ],

  },

  {

    label: "SHOP",

    items: [

      { type: "link", href: "/production", label: "Production", icon: IconTool },

      { type: "link", href: "/purchasing", label: "Purchasing", icon: IconShoppingCart },

      { type: "link", href: "/calendar", label: "Calendar", icon: IconCalendar },

    ],

  },

  {

    label: "SETTINGS",

    items: [

      {

        type: "group",

        label: "Catalogue",

        icon: IconBook,

        children: [

          { href: "/catalogue/pricing", label: "Pricing Catalogue" },

          { href: "/catalogue/material", label: "Material Catalogue" },

        ],

      },

      { type: "link", href: "/settings/integrations", label: "Integrations", icon: IconPlugConnected },

      { type: "link", href: "/admin", label: "Admin", icon: IconSettings },

    ],

  },

];



function isActive(pathname: string, href: string) {

  if (href === "/jobs") {

    return pathname === "/jobs" || pathname.startsWith("/jobs/");

  }

  if (href === "/invoices") {

    return pathname === "/invoices" || pathname.startsWith("/invoices/");

  }

  if (href === "/files") {

    return pathname === "/files" || pathname.startsWith("/files/");

  }

  if (href === "/leads") {

    return pathname === "/leads" || pathname.startsWith("/leads/");

  }

  if (href === "/catalogue/pricing") {

    return pathname.startsWith("/catalogue/pricing");

  }

  if (href === "/catalogue/material") {

    return pathname.startsWith("/catalogue/material");

  }

  return pathname === href || pathname.startsWith(href + "/");

}



function isCatalogueActive(pathname: string) {

  return pathname === "/catalogue" || pathname.startsWith("/catalogue/");

}



function formatShortName(fullName: string): string {

  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "User";

  if (parts.length === 1) return parts[0];

  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;

}



export default function Sidebar() {

  const pathname = usePathname();

  const router = useRouter();

  const [displayName, setDisplayName] = useState("User");

  const [initials, setInitials] = useState("?");

  const [catalogueOpen, setCatalogueOpen] = useState(

    () => isCatalogueActive(pathname)

  );



  useEffect(() => {

    if (isCatalogueActive(pathname)) {

      setCatalogueOpen(true);

    }

  }, [pathname]);



  useEffect(() => {

    async function loadUser() {

      const supabase = createClient();

      const {

        data: { user },

      } = await supabase.auth.getUser();

      if (!user) return;



      const { data: profile } = await supabase

        .from("profiles")

        .select("full_name")

        .eq("id", user.id)

        .maybeSingle();



      const name =

        profile?.full_name?.trim() ||

        (user.user_metadata?.full_name as string | undefined)?.trim() ||

        user.email?.split("@")[0] ||

        "User";



      setDisplayName(formatShortName(name));

      setInitials(getInitialsFromName(name));

    }



    loadUser();

  }, []);



  async function handleSignOut() {

    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/login");

    router.refresh();

  }



  return (

    <aside className="flex h-screen w-[190px] shrink-0 flex-col bg-burgundy">

      <div className="px-4 py-5">

        <p className="text-sm font-bold leading-tight text-white">

          Shipshewana Woodworks

        </p>

        <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-white/30">

          Management

        </p>

      </div>



      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2">

        {navSections.map((section) => (

          <div key={section.label}>

            <p className="mb-1 px-2 text-[9px] font-medium uppercase tracking-wider text-white/30">

              {section.label}

            </p>

            <ul className="space-y-0.5">

              {section.items.map((item) => {

                if (item.type === "link") {

                  const active = isActive(pathname, item.href);

                  const Icon = item.icon;

                  return (

                    <li key={item.href}>

                      <Link

                        href={item.href}

                        className={`flex items-center gap-2 rounded-r px-3 py-2 text-sm transition-colors ${

                          active

                            ? "border-l-2 border-white bg-white/12 text-white"

                            : "border-l-2 border-transparent text-white/60 hover:text-white/80"

                        }`}

                      >

                        <Icon size={18} stroke={1.5} />

                        {item.label}

                      </Link>

                    </li>

                  );

                }



                const groupActive = isCatalogueActive(pathname);

                const Icon = item.icon;

                return (

                  <li key={item.label}>

                    <button

                      type="button"

                      onClick={() => setCatalogueOpen((v) => !v)}

                      className={`flex w-full items-center gap-2 rounded-r px-3 py-2 text-sm transition-colors ${

                        groupActive

                          ? "border-l-2 border-white bg-white/12 text-white"

                          : "border-l-2 border-transparent text-white/60 hover:text-white/80"

                      }`}

                    >

                      <Icon size={18} stroke={1.5} />

                      <span className="flex-1 text-left">{item.label}</span>

                      <IconChevronDown

                        size={16}

                        className={`shrink-0 transition-transform ${

                          catalogueOpen ? "rotate-180" : ""

                        }`}

                      />

                    </button>

                    {catalogueOpen && (

                      <ul className="mb-1 ml-7 mt-0.5 space-y-0.5 border-l border-white/15 pl-2">

                        {item.children.map((child) => {

                          const childActive = isActive(pathname, child.href);

                          return (

                            <li key={child.href}>

                              <Link

                                href={child.href}

                                className={`block rounded-r px-2 py-1.5 text-sm transition-colors ${

                                  childActive

                                    ? "bg-white/12 font-medium text-white"

                                    : "text-white/55 hover:text-white/80"

                                }`}

                              >

                                {child.label}

                              </Link>

                            </li>

                          );

                        })}

                      </ul>

                    )}

                  </li>

                );

              })}

            </ul>

          </div>

        ))}

      </nav>



      <div className="shrink-0 border-t border-white/10 px-2 py-2">

        <button

          type="button"

          className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/8"

          aria-label="Account menu"

        >

          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">

            {initials}

          </span>

          <span className="min-w-0 flex-1 truncate text-sm text-white">

            {displayName}

          </span>

        </button>



        <button

          type="button"

          onClick={handleSignOut}

          className="mt-0.5 ml-[9px] flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm text-white/80 transition-colors hover:bg-white/8 hover:text-white"

        >

          <IconLogout size={18} stroke={1.5} />

          Sign out

        </button>

      </div>

    </aside>

  );

}


