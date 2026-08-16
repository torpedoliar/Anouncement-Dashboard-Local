"use client";

import { useEditor, EditorContent, Node, mergeAttributes } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useRef, useState } from "react";
import {
    TextB, TextAUnderline, ListBullets, ListNumbers, LinkSimple,
    ImageSquare, YoutubeLogo, VideoCamera, FolderOpen,
    AlignLeft, TextAlignCenter, AlignRight,
    TextHOne, TextHTwo, TextHThree,
    Check, Minus, Plus,
} from "@phosphor-icons/react";
import MediaPickerModal from "./MediaPickerModal";
import { useToast } from "@/contexts/ToastContext";

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

// YouTube embed extension
const YouTube = Node.create({
    name: 'youtube',
    group: 'block',
    atom: true,
    draggable: true,
    addAttributes() {
        return {
            src: { default: null },
            videoId: { default: null },
        };
    },
    parseHTML() {
        return [{
            tag: 'div[data-youtube-video]',
        }];
    },
    renderHTML({ HTMLAttributes }) {
        const videoId = HTMLAttributes.videoId;
        return ['div', mergeAttributes({ 'data-youtube-video': '', style: 'position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:16px 0;border-radius:8px;' }), [
            'iframe',
            {
                src: `https://www.youtube.com/embed/${videoId}`,
                style: 'position:absolute;top:0;left:0;width:100%;height:100%;border:0;',
                allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
                allowfullscreen: 'true',
            },
        ]];
    },
});

// Video embed extension for uploaded videos
const Video = Node.create({
    name: 'video',
    group: 'block',
    atom: true,
    draggable: true,
    addAttributes() {
        return {
            src: { default: null },
        };
    },
    parseHTML() {
        return [{
            tag: 'div[data-video]',
        }];
    },
    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes({ 'data-video': '', style: 'margin:16px 0;border-radius:8px;overflow:hidden;' }), [
            'video',
            {
                src: HTMLAttributes.src,
                controls: 'true',
                style: 'width:100%;max-height:500px;border-radius:8px;',
            },
        ]];
    },
});

export default function RichTextEditor({
    content,
    onChange,
    placeholder = "Tulis konten pengumuman...",
}: RichTextEditorProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [isVideoUploading, setIsVideoUploading] = useState(false);
    const [isImageSelected, setIsImageSelected] = useState(false);
    const [isVideoSelected, setIsVideoSelected] = useState(false);
    const [selectedImageSize, setSelectedImageSize] = useState<string>('100%');
    const [showYoutubeDialog, setShowYoutubeDialog] = useState(false);
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const [showMediaPicker, setShowMediaPicker] = useState(false);
    const { showToast } = useToast();

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
            YouTube,
            Video,
        ],
        content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        onSelectionUpdate: ({ editor }) => {
            const isImage = editor.isActive('image');
            const isVideo = editor.isActive('video') || editor.isActive('youtube');
            setIsImageSelected(isImage);
            setIsVideoSelected(isVideo);
            if (isImage) {
                const attrs = editor.getAttributes('image');
                if (attrs.width) setSelectedImageSize(attrs.width);
            }
        },
        onTransaction: ({ editor }) => {
            const isImage = editor.isActive('image');
            const isVideo = editor.isActive('video') || editor.isActive('youtube');
            if (isImage !== isImageSelected) setIsImageSelected(isImage);
            if (isVideo !== isVideoSelected) setIsVideoSelected(isVideo);
        },
        editorProps: {
            attributes: {
                style: `
                    min-height: 300px;
                    padding: 16px;
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
            showToast(message, "error");
        } finally {
            setIsUploading(false);
        }
    }, [editor]);

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleVideoUpload = useCallback(async (file: File) => {
        if (!editor) return;
        if (!file.type.startsWith('video/')) {
            showToast('Format file tidak valid. Hanya video yang diperbolehkan.', 'error');
            return;
        }
        if (file.size > 100 * 1024 * 1024) {
            showToast('Ukuran video terlalu besar. Maksimal 100MB.', 'error');
            return;
        }
        setIsVideoUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const response = await fetch("/api/media", {
                method: "POST",
                body: formData,
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Upload failed");
            }
            const data = await response.json();
            editor.chain().focus().insertContent({
                type: 'video',
                attrs: { src: data.url },
            }).run();
        } catch (error) {
            console.error("Video upload failed:", error);
            const message = error instanceof Error ? error.message : "Gagal mengupload video";
            showToast(message, "error");
        } finally {
            setIsVideoUploading(false);
        }
    }, [editor]);

    const handleVideoClick = () => {
        videoInputRef.current?.click();
    };

    const extractYoutubeId = (url: string): string | null => {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    };

    const insertYoutube = () => {
        if (!editor || !youtubeUrl) return;
        const videoId = extractYoutubeId(youtubeUrl);
        if (!videoId) {
            showToast('URL YouTube tidak valid. Gunakan format:\n• youtube.com/watch?v=XXX\n• youtu.be/XXX', 'error');
            return;
        }
        editor.chain().focus().insertContent({
            type: 'youtube',
            attrs: { videoId },
        }).run();
        setYoutubeUrl('');
        setShowYoutubeDialog(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleImageUpload(file);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const addLink = useCallback(() => {
        if (!editor) return;
        const url = window.prompt("Masukkan URL:");
        if (url) {
            editor.chain().focus().setLink({ href: url }).run();
        }
    }, [editor]);

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
        setIsImageSelected(false);
    }, [editor]);

    const deleteVideo = useCallback(() => {
        if (!editor) return;
        editor.chain().focus().deleteSelection().run();
        setIsVideoSelected(false);
    }, [editor]);

    if (!editor) {
        return (
            <div
                className="flex h-[300px] items-center justify-center text-sm"
                style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                }}
            >
                <span style={{ color: "var(--text-3)" }}>Loading editor...</span>
            </div>
        );
    }

    // Toolbar button style
    const toolbarBtn = (isActive: boolean = false) => ({
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '6px 8px',
        border: 'none', borderRadius: '4px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        background: isActive ? 'var(--brand-red)' : 'transparent',
        color: isActive ? '#fff' : 'var(--text-2)',
    });

    // Media action button style
    const mediaBtn = (isActive: boolean = false) => ({
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
        padding: '4px 8px',
        border: 'none', borderRadius: '4px',
        cursor: 'pointer', fontSize: '12px',
        background: isActive ? 'var(--brand-red)' : 'var(--surface-3)',
        color: '#fff',
    });

    return (
        <div
            className="flex flex-col"
            style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-card)",
                maxHeight: '80vh',
            }}
        >
            {/* ── Toolbar (sticky) ── */}
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 px-3 py-2 border-b"
                style={{
                    borderBottomColor: "var(--border)",
                    background: "var(--surface-2)",
                }}
            >
                {/* Headings */}
                <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    style={toolbarBtn(editor.isActive("heading", { level: 1 }))} title="Heading 1"
                >
                    <TextHOne size={16} />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    style={toolbarBtn(editor.isActive("heading", { level: 2 }))} title="Heading 2"
                >
                    <TextHTwo size={16} />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    style={toolbarBtn(editor.isActive("heading", { level: 3 }))} title="Heading 3"
                >
                    <TextHThree size={16} />
                </button>

                <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />

                {/* Formatting */}
                <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}
                    style={toolbarBtn(editor.isActive("bold"))} title="Bold (Ctrl+B)"
                >
                    <TextB size={16} weight="bold" />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}
                    style={toolbarBtn(editor.isActive("italic"))} title="Italic (Ctrl+I)"
                >
                    <TextB size={16} style={{ fontStyle: 'italic' }} />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()}
                    style={toolbarBtn(editor.isActive("underline"))} title="Underline (Ctrl+U)"
                >
                    <TextAUnderline size={16} />
                </button>

                <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />

                {/* Lists */}
                <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}
                    style={toolbarBtn(editor.isActive("bulletList"))} title="Bullet List"
                >
                    <ListBullets size={16} />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    style={toolbarBtn(editor.isActive("orderedList"))} title="Numbered List"
                >
                    <ListNumbers size={16} />
                </button>

                <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />

                {/* Alignment */}
                <button type="button" onClick={() => editor.chain().focus().setTextAlign("left").run()}
                    style={toolbarBtn(editor.isActive({ textAlign: "left" }))} title="Rata Kiri"
                >
                    <AlignLeft size={16} />
                </button>
                <button type="button" onClick={() => editor.chain().focus().setTextAlign("center").run()}
                    style={toolbarBtn(editor.isActive({ textAlign: "center" }))} title="Rata Tengah"
                >
                    <TextAlignCenter size={16} />
                </button>
                <button type="button" onClick={() => editor.chain().focus().setTextAlign("right").run()}
                    style={toolbarBtn(editor.isActive({ textAlign: "right" }))} title="Rata Kanan"
                >
                    <AlignRight size={16} />
                </button>

                <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />

                {/* Link */}
                <button type="button" onClick={addLink}
                    style={toolbarBtn(editor.isActive("link"))} title="Insert Link"
                >
                    <LinkSimple size={16} />
                </button>

                {/* Image */}
                <button type="button" onClick={handleImageClick}
                    disabled={isUploading}
                    style={{ ...toolbarBtn(), opacity: isUploading ? 0.5 : 1 }}
                    title="Insert Image"
                >
                    <ImageSquare size={16} />
                </button>

                {isUploading && <span className="text-xs" style={{ color: 'var(--text-3)', marginLeft: '6px' }}>Uploading...</span>}

                <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />

                {/* YouTube */}
                <button type="button" onClick={() => setShowYoutubeDialog(true)}
                    style={toolbarBtn()} title="Embed YouTube"
                >
                    <YoutubeLogo size={16} />
                </button>

                {/* Video upload */}
                <button type="button" onClick={handleVideoClick}
                    disabled={isVideoUploading}
                    style={{ ...toolbarBtn(), opacity: isVideoUploading ? 0.5 : 1 }}
                    title="Upload Video (MP4, max 100MB)"
                >
                    <VideoCamera size={16} />
                </button>

                {isVideoUploading && <span className="text-xs" style={{ color: 'var(--text-3)' }}>Uploading video...</span>}

                {/* Spacer */}
                <span className="ml-auto text-xs" style={{ color: 'var(--text-3)' }}>
                    ? Klik gambar untuk resize
                </span>

                {/* Media Library */}
                <button type="button" onClick={() => setShowMediaPicker(true)}
                    style={{
                        ...toolbarBtn(),
                        marginLeft: '6px',
                        background: 'var(--surface-3)',
                        border: '1px solid var(--border)',
                        padding: '4px 10px',
                    }}
                    title="Media Library"
                >
                    <FolderOpen size={14} /> Library
                </button>
            </div>

            {/* ── Image toolbar ── */}
            {isImageSelected && (
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b"
                    style={{ borderBottomColor: "var(--border)", background: "var(--surface-3)" }}
                >
                    <span className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                        Gambar:
                    </span>

                    <button type="button" onClick={() => setImageSize('25%')}
                        style={mediaBtn(selectedImageSize === '25%')} title="Ukuran 25%">
                        <Minus size={10} /> 25%
                    </button>
                    <button type="button" onClick={() => setImageSize('50%')}
                        style={mediaBtn(selectedImageSize === '50%')} title="Ukuran 50%">50%</button>
                    <button type="button" onClick={() => setImageSize('75%')}
                        style={mediaBtn(selectedImageSize === '75%')} title="Ukuran 75%">75%</button>
                    <button type="button" onClick={() => setImageSize('100%')}
                        style={mediaBtn(selectedImageSize === '100%')} title="Ukuran Penuh">
                        <Plus size={10} /> 100%
                    </button>

                    <input
                        type="number" min="10" max="100"
                        value={parseInt(selectedImageSize) || 100}
                        onChange={(e) => {
                            const val = Math.min(100, Math.max(10, parseInt(e.target.value) || 100));
                            setImageSize(`${val}%`);
                        }}
                        className="w-12 rounded border px-1.5 py-0.5 text-center text-xs text-center"
                        style={{
                            background: "var(--surface-2)",
                            borderColor: "var(--border)",
                            color: "var(--text-1)",
                        }}
                    />
                    <span className="text-xs" style={{ color: "var(--text-3)" }}>%</span>

                    <div style={{ width: '1px', height: '18px', background: 'var(--border)', margin: '0 4px' }} />

                    <button type="button" onClick={() => setImageAlign('left')}
                        style={mediaBtn()} title="Rata Kiri">
                        <AlignLeft size={12} /> Kiri
                    </button>
                    <button type="button" onClick={() => setImageAlign('center')}
                        style={mediaBtn()} title="Rata Tengah">
                        <TextAlignCenter size={12} /> Tengah
                    </button>
                    <button type="button" onClick={() => setImageAlign('right')}
                        style={mediaBtn()} title="Rata Kanan">
                        <AlignRight size={12} /> Kanan
                    </button>

                    <div style={{ width: '1px', height: '18px', background: 'var(--border)', margin: '0 4px' }} />

                    <button type="button" onClick={deleteImage}
                        style={{ ...mediaBtn(), background: 'var(--color-danger)' }} title="Hapus Gambar">
                        <Check size={12} weight="bold" /> Hapus
                    </button>
                </div>
            )}

            {/* ── Video toolbar ── */}
            {isVideoSelected && (
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b"
                    style={{ borderBottomColor: "var(--border)", background: "var(--surface-3)" }}
                >
                    <span className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                        Video:
                    </span>
                    <button type="button" onClick={deleteVideo}
                        style={{ ...mediaBtn(), background: 'var(--color-danger)' }} title="Hapus Video">
                        <Check size={12} weight="bold" /> Hapus Video
                    </button>
                </div>
            )}

            {/* ── Editor content ── */}
            <div className="flex-1 overflow-y-auto" style={{ minHeight: '300px' }}>
                <EditorContent editor={editor} />
            </div>

            {/* Hidden file inputs */}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/ogg"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) { handleVideoUpload(file); e.target.value = ''; }
                }}
                className="hidden"
            />

            {/* ── Editor styles ── */}
            <style jsx global>{`
                .tiptap {
                    min-height: 300px;
                    padding: 16px;
                }
                .tiptap p { margin: 0 0 12px 0; }
                .tiptap h1 { font-size: 28px; font-weight: 700; margin: 24px 0 12px 0; color: #fff; }
                .tiptap h2 { font-size: 22px; font-weight: 600; margin: 20px 0 10px 0; color: #fff; }
                .tiptap h3 { font-size: 18px; font-weight: 600; margin: 16px 0 8px 0; color: #fff; }
                .tiptap ul, .tiptap ol { padding-left: 24px; margin: 12px 0; }
                .tiptap li { margin: 4px 0; }
                .tiptap img {
                    max-width: 100%; height: auto; border-radius: 8px;
                    margin: 16px 0; cursor: pointer; transition: all 0.2s;
                }
                .tiptap img:hover {
                    outline: 2px dashed var(--text-muted);
                    outline-offset: 4px;
                }
                .tiptap img.ProseMirror-selectednode {
                    outline: 3px solid #dc2626;
                    outline-offset: 4px;
                }
                .tiptap img[data-align="left"] { margin-left: 0; margin-right: auto; }
                .tiptap img[data-align="center"] { margin-left: auto; margin-right: auto; display: block; }
                .tiptap img[data-align="right"] { margin-left: auto; margin-right: 0; display: block; }
                .tiptap a { color: #dc2626; text-decoration: underline; }
                .tiptap p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left; color: var(--text-muted);
                    pointer-events: none; height: 0;
                }
            `}</style>

            {/* ── YouTube dialog ── */}
            {showYoutubeDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.7)' }}
                >
                    <div className="w-full max-w-sm rounded-card p-6"
                        style={{
                            background: 'var(--surface-3)',
                            border: '1px solid var(--border)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                                <YoutubeLogo size={18} className="text-[var(--brand-red)]" /> Embed YouTube Video
                            </h3>
                            <button type="button"
                                onClick={() => { setShowYoutubeDialog(false); setYoutubeUrl(''); }}
                                className="cursor-pointer p-1" style={{ color: 'var(--text-3)' }}
                                aria-label="Tutup"
                            >
                                <Minus size={18} weight="bold" />
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="Paste YouTube URL..."
                            value={youtubeUrl}
                            onChange={(e) => setYoutubeUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && insertYoutube()}
                            className="w-full rounded-control border px-3 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-[var(--accent)]"
                            style={{
                                background: 'var(--surface-2)',
                                borderColor: 'var(--border)',
                                color: 'var(--text-1)',
                                marginBottom: '8px',
                            }}
                            autoFocus
                        />
                        <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>
                            Format: youtube.com/watch?v=XXX atau youtu.be/XXX
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button type="button"
                                onClick={() => { setShowYoutubeDialog(false); setYoutubeUrl(''); }}
                                className="rounded-control border px-4 py-2 text-sm cursor-pointer transition-colors duration-150 hover:bg-[var(--surface-2)]"
                                style={{
                                    background: 'transparent',
                                    borderColor: 'var(--border)',
                                    color: 'var(--text-2)',
                                }}
                            >
                                Batal
                            </button>
                            <button type="button" onClick={insertYoutube} disabled={!youtubeUrl}
                                className="rounded-control px-4 py-2 text-sm font-semibold cursor-pointer transition-opacity duration-150"
                                style={{
                                    background: 'var(--brand-red)',
                                    color: 'var(--text-1)',
                                    opacity: youtubeUrl ? 1 : 0.5,
                                }}
                            >
                                Embed
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Media Picker Modal */}
            <MediaPickerModal
                isOpen={showMediaPicker}
                onClose={() => setShowMediaPicker(false)}
                onSelect={(url, type) => {
                    if (type === "video") {
                        editor?.chain().focus().insertContent({
                            type: 'video',
                            attrs: { src: url },
                        }).run();
                    } else {
                        editor?.chain().focus().setImage({ src: url }).run();
                    }
                    setShowMediaPicker(false);
                }}
                mediaType="all"
            />
        </div>
    );
}
