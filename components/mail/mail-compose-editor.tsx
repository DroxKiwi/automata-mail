"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Palette,
  Strikethrough,
  Underline,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type MailComposeEditorRef = {
  getHtml: () => string;
  getText: () => string;
  clear: () => void;
};

type MailComposeEditorProps = {
  disabled?: boolean;
  className?: string;
};

export const MailComposeEditor = forwardRef<
  MailComposeEditorRef,
  MailComposeEditorProps
>(function MailComposeEditor({ disabled, className }, ref) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      TextStyle,
      Color,
      Placeholder.configure({
        placeholder: "Rédigez votre message…",
      }),
    ],
    content: "<p></p>",
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          "mail-compose-tiptap min-h-[12rem] px-2.5 py-2 text-sm text-foreground outline-none",
        ),
      },
    },
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  useImperativeHandle(
    ref,
    () => ({
      getHtml: () => editor?.getHTML() ?? "",
      getText: () => editor?.getText() ?? "",
      clear: () => {
        editor?.commands.clearContent();
      },
    }),
    [editor],
  );

  if (!mounted) {
    return (
      <div
        className={cn(
          "min-h-[12rem] rounded-md border border-input bg-muted/30",
          className,
        )}
        aria-hidden
      />
    );
  }

  if (!editor) {
    return null;
  }

  const color =
    (editor.getAttributes("textStyle").color as string | undefined) ??
    "#1a1a1a";

  return (
    <div className={cn("mail-compose-editor rounded-md border border-input", className)}>
      <div
        className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-1.5 py-1"
        role="toolbar"
        aria-label="Mise en forme"
      >
        <Button
          type="button"
          variant={editor.isActive("bold") ? "secondary" : "ghost"}
          size="icon-sm"
          className="size-8"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={disabled}
          aria-label="Gras"
          title="Gras"
        >
          <Bold className="size-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("italic") ? "secondary" : "ghost"}
          size="icon-sm"
          className="size-8"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={disabled}
          aria-label="Italique"
          title="Italique"
        >
          <Italic className="size-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("underline") ? "secondary" : "ghost"}
          size="icon-sm"
          className="size-8"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={disabled}
          aria-label="Souligné"
          title="Souligné"
        >
          <Underline className="size-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("strike") ? "secondary" : "ghost"}
          size="icon-sm"
          className="size-8"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={disabled}
          aria-label="Barré"
          title="Barré"
        >
          <Strikethrough className="size-4" />
        </Button>

        <Separator orientation="vertical" className="mx-0.5 h-6" />

        <div className="flex items-center gap-1">
          <Palette className="size-3.5 text-muted-foreground" aria-hidden />
          <input
            type="color"
            value={color.startsWith("#") ? color : "#1a1a1a"}
            onChange={(e) =>
              editor.chain().focus().setColor(e.target.value).run()
            }
            disabled={disabled}
            className="h-7 w-10 cursor-pointer rounded border border-border bg-background p-0.5"
            title="Couleur du texte"
            aria-label="Couleur du texte"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => editor.chain().focus().unsetColor().run()}
            disabled={disabled}
          >
            Effacer
          </Button>
        </div>

        <Separator orientation="vertical" className="mx-0.5 h-6" />

        <Button
          type="button"
          variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
          size="icon-sm"
          className="size-8"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={disabled}
          aria-label="Liste à puces"
          title="Liste à puces"
        >
          <List className="size-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("orderedList") ? "secondary" : "ghost"}
          size="icon-sm"
          className="size-8"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={disabled}
          aria-label="Liste numérotée"
          title="Liste numérotée"
        >
          <ListOrdered className="size-4" />
        </Button>
      </div>

      <EditorContent editor={editor} className="max-h-[min(50vh,22rem)] overflow-y-auto" />
    </div>
  );
});
