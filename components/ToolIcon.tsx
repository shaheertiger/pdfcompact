import {
  Combine, Scissors, LayoutGrid, Trash2, FileOutput, RotateCw, Ruler, SquareSplitHorizontal,
  Shuffle, Crop, Minimize2, Layers, Diff, FileArchive, FileType, FileText, FileImage, Image as ImageIcon,
  FileSpreadsheet, BookOpen, Images, Sheet, Smartphone, BookText, PenLine, FileSignature, Hash,
  Stamp, Lock, ScanText, Camera, ImagePlus, ImageDown, Scaling, TextCursorInput, type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Combine, Scissors, LayoutGrid, Trash2, FileOutput, RotateCw, Ruler, SquareSplitHorizontal,
  Shuffle, Crop, Minimize2, Layers, Diff, FileArchive, FileType, FileText, FileImage, Image: ImageIcon,
  FileSpreadsheet, BookOpen, Images, Sheet, Smartphone, BookText, PenLine, FileSignature, Hash,
  Stamp, Lock, ScanText, Camera, ImagePlus, ImageDown, Scaling, TextCursorInput,
};

export default function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = iconMap[name] ?? FileText;
  return <Icon className={className} aria-hidden="true" />;
}
