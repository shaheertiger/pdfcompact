import {
  Combine,
  Scissors,
  ArrowDownUp,
  Trash2,
  FileOutput,
  FileText,
  FileType,
  Image as ImageIcon,
  FileImage,
  PenLine,
  FileSignature,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Combine,
  Scissors,
  ArrowDownUp,
  Trash2,
  FileOutput,
  FileText,
  FileType,
  Image: ImageIcon,
  FileImage,
  PenLine,
  FileSignature,
};

type ToolIconProps = {
  name: string;
  className?: string;
};

export default function ToolIcon({ name, className }: ToolIconProps) {
  const Icon = iconMap[name] ?? FileText;
  return <Icon className={className} aria-hidden="true" />;
}
