import React from "react";
import { cn } from "../../lib/utils";
import { Link } from "react-router-dom";

type SidebarItemProps = {
  icon?: React.ReactNode;
  label: string;
  to: string;
  active?: boolean;
  badge?: string | number;
  onClick?: () => void;
};

const SidebarItem = ({ icon, label, to, active, badge, onClick }: SidebarItemProps) => {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground"
      )}
      onClick={(e) => {
        if (to === '#' && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {icon && <span className="h-5 w-5">{icon}</span>}
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
          {badge}
        </span>
      )}
    </Link>
  );
};

type SidebarSectionProps = {
  title?: string;
  children: React.ReactNode;
};

const SidebarSection = ({ title, children }: SidebarSectionProps) => {
  return (
    <div className="py-2">
      {title && (
        <h3 className="mb-2 px-4 text-xs font-semibold text-foreground">{title}</h3>
      )}
      <div className="space-y-1 px-2">{children}</div>
    </div>
  );
};

type SidebarProps = {
  children: React.ReactNode;
  className?: string;
};

const Sidebar = ({ children, className }: SidebarProps) => {
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-y-auto border-r bg-background",
        className
      )}
    >
      <div className="flex-1 p-4">{children}</div>
    </div>
  );
};

export { Sidebar, SidebarItem, SidebarSection }; 