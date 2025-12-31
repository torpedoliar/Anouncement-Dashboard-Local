"use client";

import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useRef, useState } from "react";
import {
    FiBold,
    FiItalic,
    FiUnderline,
    FiList,
    FiImage,
    FiLink,
    FiAlignLeft,
    FiAlignCenter,
    FiAlignRight,
    FiMaximize,
    FiMinimize,
    FiTrash2,
} from "react-icons/fi";
import { LuHeading1, LuHeading2, LuHeading3, LuListOrdered } from "react-icons/lu";

interface RichTextEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
}

// Custom Image extension with alignment and size support
const CustomImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            align: {
                default: 'center',
                parseHTML: element => element.getAttribute('data-align') || 'center',
                renderHTML: attributes => {
                    return { 'data-align': attributes.align };
                },
            },
            width: {
                default: '100%',
                parseHTML: element => element.getAttribute('width') || element.style.width || '100%',
                renderHTML: attributes => {
                    return { width: attributes.width, style: `width: ${attributes.width}` };
                },
            },
        };
    },
});

export default function RichTextEditor({
    content,
    onChange,
    placeholder = "Tulis konten pengumuman...",
}: RichTextEditorProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [selectedImageSize, setSelectedImageSize] = useState<string>('100%');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
                link: false,
                underline: false,
            }),
            CustomImage.configure({
                HTMLAttributes: {
                    style: "max-width: 100%; height: auto; border-radius: 8px; margin: 16px auto; display: block;",
                },
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    style: "color: #dc2626; text-decoration: underline;",
                },
            }),
            Underline,
            TextAlign.configure({
                types: ["heading", "paragraph", "image"],
            }),
            Placeholder.configure({
                placeholder,
            }),
        ],
        content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                style: `
                    min-height: 300px;
                    padding: 16px;
                    outline: none;
                    color: #fff;
                    font-size: 15px;
                    line-height: 1.7;
                `,
            },
        },
    });

    const handleImageUpload = useCallback(async (file: File) => {
        if (!editor) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Upload failed");
            }

            const data = await response.json();
            editor.chain().focus().setImage({
                src: data.url,
                alt: file.name,
            }).run();
        } catch (error) {
            console.error("Image upload failed:", error);
            const message = error instanceof Error ? error.message : "Gagal mengupload gambar";
            alert(message);
        } finally {
            setIsUploading(false);
        }
    }, [editor]);

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleImageUpload(file);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const addLink = useCallback(() => {
        if (!editor) return;
        const url = window.prompt("Masukkan URL:");
        if (url) {
            editor.chain().focus().setLink({ href: url }).run();
        }
    }, [editor]);

    // Image manipulation functions
    const setImageAlign = useCallback((align: 'left' | 'center' | 'right') => {
        if (!editor) return;
        editor.chain().focus().updateAttributes('image', { align }).run();
    }, [editor]);

    const setImageSize = useCallback((width: string) => {
        if (!editor) return;
        setSelectedImageSize(width);
        editor.chain().focus().updateAttributes('image', { width }).run();
    }, [editor]);

    const deleteImage = useCallback(() => {
        if (!editor) return;
        editor.chain().focus().deleteSelection().run();
    }, [editor]);

    if (!editor) {
        return (
            <div style={{
                backgroundColor: '#0a0a0a',
                border: '1px solid #262626',
                minHeight: '350px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#525252',
            }}>
                Loading editor...
            </div>
        );
    }

    const buttonStyle = (isActive: boolean = false) => ({
        padding: '8px',
        backgroundColor: isActive ? '#dc2626' : 'transparent',
        color: isActive ? '#fff' : '#a3a3a3',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
    });

    const dividerStyle = {
        width: '1px',
        height: '24px',
        backgroundColor: '#333',
        margin: '0 4px',
    };

    const bubbleButtonStyle = (isActive: boolean = false) => ({
        padding: '6px 10px',
        backgroundColor: isActive ? '#dc2626' : '#1a1a1a',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        fontSize: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
    });

    return (
        <div style={{
            backgroundColor: '#0a0a0a',
            border: '1px solid #262626',
            overflow: 'hidden',
        }}>
            {/* Toolbar */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '2px',
                padding: '8px 12px',
                borderBottom: '1px solid #262626',
                backgroundColor: '#0f0f0f',
            }}>
                {/* Headings */}
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    style={buttonStyle(editor.isActive("heading", { level: 1 }))}
                    title="Heading 1"
                >
                    <LuHeading1 size={18} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    style={buttonStyle(editor.isActive("heading", { level: 2 }))}
                    title="Heading 2"
                >
                    <LuHeading2 size={18} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    style={buttonStyle(editor.isActive("heading", { level: 3 }))}
                    title="Heading 3"
                >
                    <LuHeading3 size={18} />
                </button>

                <div style={dividerStyle} />

                {/* Text Formatting */}
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    style={buttonStyle(editor.isActive("bold"))}
                    title="Bold (Ctrl+B)"
                >
                    <FiBold size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    style={buttonStyle(editor.isActive("italic"))}
                    title="Italic (Ctrl+I)"
                >
                    <FiItalic size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    style={buttonStyle(editor.isActive("underline"))}
                    title="Underline (Ctrl+U)"
                >
                    <FiUnderline size={16} />
                </button>

                <div style={dividerStyle} />

                {/* Lists */}
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    style={buttonStyle(editor.isActive("bulletList"))}
                    title="Bullet List"
                >
                    <FiList size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    style={buttonStyle(editor.isActive("orderedList"))}
                    title="Numbered List"
                >
                    <LuListOrdered size={16} />
                </button>

                <div style={dividerStyle} />

                {/* Alignment */}
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign("left").run()}
                    style={buttonStyle(editor.isActive({ textAlign: "left" }))}
                    title="Align Left"
                >
                    <FiAlignLeft size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign("center").run()}
                    style={buttonStyle(editor.isActive({ textAlign: "center" }))}
                    title="Align Center"
                >
                    <FiAlignCenter size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign("right").run()}
                    style={buttonStyle(editor.isActive({ textAlign: "right" }))}
                    title="Align Right"
                >
                    <FiAlignRight size={16} />
                </button>

                <div style={dividerStyle} />

                {/* Link & Image */}
                <button
                    type="button"
                    onClick={addLink}
                    style={buttonStyle(editor.isActive("link"))}
                    title="Insert Link"
                >
                    <FiLink size={16} />
                </button>
                <button
                    type="button"
                    onClick={handleImageClick}
                    disabled={isUploading}
                    style={{
                        ...buttonStyle(),
                        opacity: isUploading ? 0.5 : 1,
                    }}
                    title="Insert Image"
                >
                    <FiImage size={16} />
                </button>

                {isUploading && (
                    <span style={{ color: '#737373', fontSize: '12px', marginLeft: '8px' }}>
                        Uploading...
                    </span>
                )}
            </div>

            {/* Bubble Menu for Image - appears when image is selected */}
            {editor && (
                <BubbleMenu
                    editor={editor}
                    tippyOptions={{ duration: 100 }}
                    shouldShow={({ editor }) => editor.isActive('image')}
                >
                    <div style={{
                        display: 'flex',
                        backgroundColor: '#000',
                        border: '1px solid #333',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    }}>
                        {/* Size Controls */}
                        <button
                            type="button"
                            onClick={() => setImageSize('25%')}
                            style={bubbleButtonStyle(selectedImageSize === '25%')}
                            title="Ukuran 25%"
                        >
                            <FiMinimize size={12} /> 25%
                        </button>
                        <button
                            type="button"
                            onClick={() => setImageSize('50%')}
                            style={bubbleButtonStyle(selectedImageSize === '50%')}
                            title="Ukuran 50%"
                        >
                            50%
                        </button>
                        <button
                            type="button"
                            onClick={() => setImageSize('75%')}
                            style={bubbleButtonStyle(selectedImageSize === '75%')}
                            title="Ukuran 75%"
                        >
                            75%
                        </button>
                        <button
                            type="button"
                            onClick={() => setImageSize('100%')}
                            style={bubbleButtonStyle(selectedImageSize === '100%')}
                            title="Ukuran Penuh"
                        >
                            <FiMaximize size={12} /> 100%
                        </button>

                        <div style={{ width: '1px', backgroundColor: '#333' }} />

                        {/* Alignment Controls */}
                        <button
                            type="button"
                            onClick={() => setImageAlign('left')}
                            style={bubbleButtonStyle()}
                            title="Rata Kiri"
                        >
                            <FiAlignLeft size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setImageAlign('center')}
                            style={bubbleButtonStyle()}
                            title="Rata Tengah"
                        >
                            <FiAlignCenter size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setImageAlign('right')}
                            style={bubbleButtonStyle()}
                            title="Rata Kanan"
                        >
                            <FiAlignRight size={14} />
                        </button>

                        <div style={{ width: '1px', backgroundColor: '#333' }} />

                        {/* Delete */}
                        <button
                            type="button"
                            onClick={deleteImage}
                            style={{ ...bubbleButtonStyle(), backgroundColor: '#7f1d1d' }}
                            title="Hapus Gambar"
                        >
                            <FiTrash2 size={14} />
                        </button>
                    </div>
                </BubbleMenu>
            )}

            {/* Editor Content */}
            <EditorContent editor={editor} />

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />

            {/* Editor Styles */}
            <style jsx global>{`
                .tiptap {
                    min-height: 300px;
                    padding: 16px;
                    outline: none;
                }
                .tiptap p {
                    margin: 0 0 12px 0;
                }
                .tiptap h1 {
                    font-size: 28px;
                    font-weight: 700;
                    margin: 24px 0 12px 0;
                    color: #fff;
                }
                .tiptap h2 {
                    font-size: 22px;
                    font-weight: 600;
                    margin: 20px 0 10px 0;
                    color: #fff;
                }
                .tiptap h3 {
                    font-size: 18px;
                    font-weight: 600;
                    margin: 16px 0 8px 0;
                    color: #fff;
                }
                .tiptap ul, .tiptap ol {
                    padding-left: 24px;
                    margin: 12px 0;
                }
                .tiptap li {
                    margin: 4px 0;
                }
                .tiptap img {
                    max-width: 100%;
                    height: auto;
                    border-radius: 8px;
                    margin: 16px 0;
                    cursor: pointer;
                    transition: outline 0.2s;
                }
                .tiptap img.ProseMirror-selectednode {
                    outline: 3px solid #dc2626;
                }
                .tiptap img[data-align="left"] {
                    margin-left: 0;
                    margin-right: auto;
                }
                .tiptap img[data-align="center"] {
                    margin-left: auto;
                    margin-right: auto;
                    display: block;
                }
                .tiptap img[data-align="right"] {
                    margin-left: auto;
                    margin-right: 0;
                    display: block;
                }
                .tiptap a {
                    color: #dc2626;
                    text-decoration: underline;
                }
                .tiptap p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left;
                    color: #525252;
                    pointer-events: none;
                    height: 0;
                }
                .tiptap:focus {
                    outline: none;
                }
            `}</style>
        </div>
    );
}
