"use client";

import { useEditor, EditorContent, Node, mergeAttributes } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    TextB, TextAUnderline, ListBullets, ListNumbers, LinkSimple,
    ImageSquare, YoutubeLogo, VideoCamera, FolderOpen,
    AlignLeft, TextAlignCenter, AlignRight,
    TextHOne, TextHTwo, TextHThree,
    Check, Minus, Plus, FilePdf, UploadSimple,
} from "@phosphor-icons/react";
import MediaPickerModal from "./MediaPickerModal";
import { useToast } from "@/contexts/ToastContext";

interface RichTextEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
}

/** Pemisah vertikal antar-grup tombol toolbar. */
function Divider({ h = 20 }: { h?: number }) {
    return <div aria-hidden="true" className="mx-1 w-px shrink-0 bg-border" style={{ height: `${h}px` }} />;
}

function VDivider() {
    return <Divider h={18} />;
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

// PDF embed extension for uploaded PDFs or external .pdf URLs.
// renderHTML emits EXACTLY div + data-pdf/data-src/data-filename (the 12-01
// sanitizer whitelist) in the steady state. A transient data-pdf-error is
// emitted only while an upload is failing; the server sanitizer strips it at
// save so persisted markup never carries it. data-pdf-id is an in-editor-only
// nonce for matching optimistic blocks (WR-03); it is stripped by the same
// sanitizer at save and never parsed back from HTML.
const Pdf = Node.create({
    name: 'pdf',
    group: 'block',
    atom: true,
    draggable: true,
    addAttributes() {
        return {
            src: {
                default: null,
                // Baca balik data-src saat artikel lama dibuka ulang (12-02) —
                // tanpa ini simpan ulang menghapus data-src semua blok PDF
                // (regresi yang sempat ditimbulkan WR-03). String literal
                // "null", jejak serialisasi pra-IN-01, diperlakukan kosong agar
                // simpan berikutnya ikut membersihkannya.
                parseHTML: element => {
                    const value = element.getAttribute('data-src');
                    return value && value !== 'null' ? value : null;
                },
            },
            filename: {
                default: null,
                parseHTML: element => element.getAttribute('data-filename'),
            },
            // Nonce sisi editor (WR-03): identitas stabil satu insert, tidak
            // pernah diparse balik dari HTML maupun disimpan ke server.
            pdfId: {
                default: null,
                parseHTML: () => null,
                renderHTML: () => ({}),
            },
            error: {
                default: false,
                parseHTML: element => element.hasAttribute('data-pdf-error'),
                renderHTML: attributes => (attributes.error ? { 'data-pdf-error': '' } : {}),
            },
        };
    },
    parseHTML() {
        return [{
            tag: 'div[data-pdf]',
        }];
    },
    renderHTML({ HTMLAttributes }) {
        const { pdfId: _pdfId, ...rest } = HTMLAttributes as Record<string, unknown>;
        void _pdfId;
        return ['div', mergeAttributes({
            'data-pdf': '',
            ...(rest.src ? { 'data-src': String(rest.src) } : {}),
            'data-filename': rest.filename || '',
        })];
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
    const pdfInputRef = useRef<HTMLInputElement>(null);
    const [showMediaPicker, setShowMediaPicker] = useState(false);
    const [isPdfUploading, setIsPdfUploading] = useState(false);
    const [isPdfSelected, setIsPdfSelected] = useState(false);
    const [selectedPdfFilename, setSelectedPdfFilename] = useState('');
    const [showPdfMenu, setShowPdfMenu] = useState(false);
    const [showPdfUrlDialog, setShowPdfUrlDialog] = useState(false);
    const [pdfUrl, setPdfUrl] = useState('');
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
                    style: "color: var(--accent); text-decoration: underline;",
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
            Pdf,
        ],
        content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        onSelectionUpdate: ({ editor }) => {
            const isImage = editor.isActive('image');
            const isVideo = editor.isActive('video') || editor.isActive('youtube');
            const isPdf = editor.isActive('pdf');
            setIsImageSelected(isImage);
            setIsVideoSelected(isVideo);
            setIsPdfSelected(isPdf);
            if (isPdf) {
                const attrs = editor.getAttributes('pdf');
                setSelectedPdfFilename(attrs.filename || '');
            }
            if (isImage) {
                const attrs = editor.getAttributes('image');
                if (attrs.width) setSelectedImageSize(attrs.width);
            }
        },
        onTransaction: ({ editor }) => {
            const isImage = editor.isActive('image');
            const isVideo = editor.isActive('video') || editor.isActive('youtube');
            const isPdf = editor.isActive('pdf');
            if (isImage !== isImageSelected) setIsImageSelected(isImage);
            if (isVideo !== isVideoSelected) setIsVideoSelected(isVideo);
            if (isPdf !== isPdfSelected) setIsPdfSelected(isPdf);
        },
        editorProps: {
            attributes: {
                style: `
                    min-height: 300px;
                    padding: 16px;
                    color: var(--text-1);
                    font-size: 15px;
                    line-height: 1.7;
                `,
            },
        },
    });

    // Sinkronisasi konten editor jika prop content diperbarui dari luar (mis. restore draft)
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content || "", { emitUpdate: false });
        }
    }, [content, editor]);

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
    }, [editor, showToast]);

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
    }, [editor, showToast]);

    const handleVideoClick = () => {
        videoInputRef.current?.click();
    };

    // ── PDF helpers ────────────────────────────────────────────────
    // WR-03: blok optimistis dicocokkan lewat nonce data-pdf-id, bukan posisi
    // insert-time — posisi basi begitu user mengetik/menyisipkan node lain
    // selagi unggahan berjalan (mark mendarat di node salah atau no-op).
    const findPdfNodeByNonce = useCallback((pdfId: string): number => {
        if (!editor || !pdfId) return -1;
        let found = -1;
        editor.state.doc.descendants((n, pos) => {
            if (found === -1 && n.type.name === 'pdf' && n.attrs.pdfId === pdfId) {
                found = pos;
            }
        });
        return found;
    }, [editor]);

    // Update attributes of the optimistic pdf block (src on success / error on failure).
    const markPdfBlock = useCallback((pdfId: string, attrs: { src?: string; error?: boolean }) => {
        if (!editor) return;
        const pos = findPdfNodeByNonce(pdfId);
        if (pos < 0) return;
        editor.chain().focus().setNodeSelection(pos).updateAttributes('pdf', attrs).run();
    }, [editor, findPdfNodeByNonce]);

    const handlePdfUpload = useCallback(async (file: File) => {
        if (!editor) return;
        if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
            showToast('Format file tidak valid. Hanya PDF yang diperbolehkan.', 'error');
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            showToast('Ukuran file terlalu besar. Maksimal 50MB untuk PDF.', 'error');
            return;
        }
        setIsPdfUploading(true);
        let pdfId = '';
        try {
            // Optimistic block FIRST: named placeholder appears immediately (D-02).
            // Nonce unik per insert → mark pasca-upload selalu mengenai blok ini,
            // apa pun yang terjadi pada posisi dokumen selama transfer.
            pdfId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            editor.chain().focus().insertContent({
                type: 'pdf',
                attrs: { src: '', filename: file.name, pdfId },
            }).run();
            const formData = new FormData();
            formData.append("file", file);
            const response = await fetch("/api/media", {
                method: "POST",
                body: formData,
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || "Gagal mengunggah PDF");
            }
            const data = await response.json();
            // Update the SAME block's src in place (no new node). Filename kept.
            markPdfBlock(pdfId, { src: data.url });
        } catch (error) {
            // Red block + message (D-02). Transient data-pdf-error is stripped
            // by the server sanitizer at save — never persisted.
            markPdfBlock(pdfId, { error: true });
            const message = error instanceof Error ? error.message : "Gagal mengunggah PDF";
            showToast(message, "error");
        } finally {
            setIsPdfUploading(false);
        }
    }, [editor, markPdfBlock, showToast]);

    const handlePdfClick = () => {
        setShowPdfMenu(false);
        pdfInputRef.current?.click();
    };

    const parsePdfUrl = (rawUrl: string): URL | null => {
        let parsed: URL;
        try {
            parsed = new URL(rawUrl.trim());
        } catch {
            return null;
        }
        // Reject javascript:/data:/file: and any non-http(s) scheme (T-12-02-URLSCHEME).
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        if (!parsed.pathname.toLowerCase().endsWith('.pdf')) return null;
        return parsed;
    };

    const insertPdfUrl = useCallback(() => {
        if (!editor || !pdfUrl) return;
        const parsed = parsePdfUrl(pdfUrl);
        if (!parsed) {
            showToast('URL PDF tidak valid. Gunakan https://.../*.pdf', 'error');
            return;
        }
        const filename = parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname;
        // External .pdf URL: insert block directly, no upload, no MediaLibrary row (R3).
        editor.chain().focus().insertContent({
            type: 'pdf',
            attrs: { src: parsed.href, filename },
        }).run();
        setPdfUrl('');
        setShowPdfUrlDialog(false);
    }, [editor, pdfUrl, showToast]);

    const deletePdf = useCallback(() => {
        if (!editor) return;
        editor.chain().focus().deleteSelection().run();
        setIsPdfSelected(false);
    }, [editor]);

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
            <div className="flex h-[300px] items-center justify-center rounded-card border border-border bg-surface-2 text-sm">
                <span className="text-text-3">Loading editor...</span>
            </div>
        );
    }

    // Tombol toolbar — kelas token, state aktif = accent bg + teks putih.
    // (Putih di atas --accent merah brand dipakai hanya untuk ikon 16px, bukan
    // body text, jadi tidak tunduk pada batas AA 14px.)
    const toolbarBtn = (isActive: boolean = false) =>
        `flex cursor-pointer items-center justify-center rounded px-2 py-1.5 transition-colors duration-150 hover:bg-surface-3 ${
            isActive ? "bg-accent text-white" : "bg-transparent text-text-2"
        }`;

    // Tombol aksi media (resize/align/hapus) — state aktif = accent bg.
    const mediaBtn = (isActive: boolean = false) =>
        `flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors duration-150 ${
            isActive ? "bg-accent text-white" : "bg-surface-3 text-text-2 hover:text-text-1"
        }`;

    return (
        <div className="flex max-h-[80vh] flex-col rounded-card border border-border bg-surface-1">
            {/* ── Toolbar (sticky) ── */}
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-border bg-surface-2 px-3 py-2">
                {/* Headings */}
                <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={toolbarBtn(editor.isActive("heading", { level: 1 }))} title="Heading 1"
                >
                    <TextHOne size={16} />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={toolbarBtn(editor.isActive("heading", { level: 2 }))} title="Heading 2"
                >
                    <TextHTwo size={16} />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    className={toolbarBtn(editor.isActive("heading", { level: 3 }))} title="Heading 3"
                >
                    <TextHThree size={16} />
                </button>

                <Divider />

                {/* Formatting */}
                <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}
                    className={toolbarBtn(editor.isActive("bold"))} title="Bold (Ctrl+B)"
                >
                    <TextB size={16} weight="bold" />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={toolbarBtn(editor.isActive("italic"))} title="Italic (Ctrl+I)"
                >
                    <TextB size={16} style={{ fontStyle: 'italic' }} />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={toolbarBtn(editor.isActive("underline"))} title="Underline (Ctrl+U)"
                >
                    <TextAUnderline size={16} />
                </button>

                <Divider />

                {/* Lists */}
                <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={toolbarBtn(editor.isActive("bulletList"))} title="Bullet List"
                >
                    <ListBullets size={16} />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={toolbarBtn(editor.isActive("orderedList"))} title="Numbered List"
                >
                    <ListNumbers size={16} />
                </button>

                <Divider />

                {/* Alignment */}
                <button type="button" onClick={() => editor.chain().focus().setTextAlign("left").run()}
                    className={toolbarBtn(editor.isActive({ textAlign: "left" }))} title="Rata Kiri"
                >
                    <AlignLeft size={16} />
                </button>
                <button type="button" onClick={() => editor.chain().focus().setTextAlign("center").run()}
                    className={toolbarBtn(editor.isActive({ textAlign: "center" }))} title="Rata Tengah"
                >
                    <TextAlignCenter size={16} />
                </button>
                <button type="button" onClick={() => editor.chain().focus().setTextAlign("right").run()}
                    className={toolbarBtn(editor.isActive({ textAlign: "right" }))} title="Rata Kanan"
                >
                    <AlignRight size={16} />
                </button>

                <Divider />

                {/* Link */}
                <button type="button" onClick={addLink}
                    className={toolbarBtn(editor.isActive("link"))} title="Insert Link"
                >
                    <LinkSimple size={16} />
                </button>

                {/* Image */}
                <button type="button" onClick={handleImageClick}
                    disabled={isUploading}
                    className={`${toolbarBtn()} disabled:cursor-not-allowed disabled:opacity-50`}
                    title="Insert Image"
                >
                    <ImageSquare size={16} />
                </button>

                {isUploading && <span className="ml-1.5 text-xs text-text-3">Uploading...</span>}

                <Divider />

                {/* YouTube */}
                <button type="button" onClick={() => setShowYoutubeDialog(true)}
                    className={toolbarBtn()} title="Embed YouTube"
                >
                    <YoutubeLogo size={16} />
                </button>

                {/* Video upload */}
                <button type="button" onClick={handleVideoClick}
                    disabled={isVideoUploading}
                    className={`${toolbarBtn()} disabled:cursor-not-allowed disabled:opacity-50`}
                    title="Upload Video (MP4, max 100MB)"
                >
                    <VideoCamera size={16} />
                </button>

                {isVideoUploading && <span className="text-xs text-text-3">Uploading video...</span>}

                {/* PDF: one FilePdf button with Upload vs URL dropdown (D-01) */}
                <div className="relative">
                    <button type="button" onClick={() => setShowPdfMenu((v) => !v)}
                        disabled={isPdfUploading}
                        className={`${toolbarBtn()} disabled:cursor-not-allowed disabled:opacity-50`}
                        title="Sisipkan PDF"
                    >
                        <FilePdf size={16} />
                    </button>

                    {showPdfMenu && (
                        <>
                            <div className="fixed inset-0 z-40"
                                onClick={() => setShowPdfMenu(false)}
                            />
                            <div
                                className="absolute left-0 top-[calc(100%+6px)] z-dropdown min-w-[190px] rounded-card border border-border bg-surface-3 p-1 shadow-lvl-2"
                            >
                                <button type="button" onClick={handlePdfClick}
                                    className="rich-editor-pdf-menu-item flex w-full cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-left text-[12.5px] text-text-1"
                                >
                                    <UploadSimple size={16} className="text-accent" /> Upload PDF
                                </button>
                                <button type="button"
                                    onClick={() => { setShowPdfMenu(false); setShowPdfUrlDialog(true); }}
                                    className="rich-editor-pdf-menu-item flex w-full cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-left text-[12.5px] text-text-1"
                                >
                                    <LinkSimple size={16} className="text-accent" /> Sisipkan via URL
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {isPdfUploading && <span className="text-xs text-text-3">Uploading PDF...</span>}

                {/* Spacer */}
                <span className="ml-auto text-xs text-text-3">
                    ? Klik gambar untuk resize
                </span>

                {/* Media Library */}
                <button type="button" onClick={() => setShowMediaPicker(true)}
                    className={`${mediaBtn()} ml-1.5 border border-border`}
                    title="Media Library"
                >
                    <FolderOpen size={14} /> Library
                </button>
            </div>

            {/* ── Image toolbar ── */}
            {isImageSelected && (
                <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-3 px-3 py-2">
                    <span className="text-xs font-semibold text-text-2">
                        Gambar:
                    </span>

                    <button type="button" onClick={() => setImageSize('25%')}
                        className={mediaBtn(selectedImageSize === '25%')} title="Ukuran 25%">
                        <Minus size={10} /> 25%
                    </button>
                    <button type="button" onClick={() => setImageSize('50%')}
                        className={mediaBtn(selectedImageSize === '50%')} title="Ukuran 50%">50%</button>
                    <button type="button" onClick={() => setImageSize('75%')}
                        className={mediaBtn(selectedImageSize === '75%')} title="Ukuran 75%">75%</button>
                    <button type="button" onClick={() => setImageSize('100%')}
                        className={mediaBtn(selectedImageSize === '100%')} title="Ukuran Penuh">
                        <Plus size={10} /> 100%
                    </button>

                    <input
                        type="number" min="10" max="100"
                        value={parseInt(selectedImageSize) || 100}
                        onChange={(e) => {
                            const val = Math.min(100, Math.max(10, parseInt(e.target.value) || 100));
                            setImageSize(`${val}%`);
                        }}
                        className="w-12 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-center text-xs text-text-1"
                    />
                    <span className="text-xs text-text-3">%</span>

                    <VDivider />

                    <button type="button" onClick={() => setImageAlign('left')}
                        className={mediaBtn()} title="Rata Kiri">
                        <AlignLeft size={12} /> Kiri
                    </button>
                    <button type="button" onClick={() => setImageAlign('center')}
                        className={mediaBtn()} title="Rata Tengah">
                        <TextAlignCenter size={12} /> Tengah
                    </button>
                    <button type="button" onClick={() => setImageAlign('right')}
                        className={mediaBtn()} title="Rata Kanan">
                        <AlignRight size={12} /> Kanan
                    </button>

                    <VDivider />

                    <button type="button" onClick={deleteImage}
                        className={`${mediaBtn()} bg-danger text-white`} title="Hapus Gambar">
                        <Check size={12} weight="bold" /> Hapus
                    </button>
                </div>
            )}

            {/* ── Video toolbar ── */}
            {isVideoSelected && (
                <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-3 px-3 py-2">
                    <span className="text-xs font-semibold text-text-2">
                        Video:
                    </span>
                    <button type="button" onClick={deleteVideo}
                        className={`${mediaBtn()} bg-danger text-white`} title="Hapus Video">
                        <Check size={12} weight="bold" /> Hapus Video
                    </button>
                </div>
            )}

            {/* ── PDF toolbar ── */}
            {isPdfSelected && (
                <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-3 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-text-2">
                        <FilePdf size={14} className="text-accent" /> PDF:
                    </span>
                    <span className="max-w-[280px] truncate text-xs font-medium text-text-1">
                        {selectedPdfFilename}
                    </span>
                    <VDivider />
                    <button type="button" onClick={deletePdf}
                        className={`${mediaBtn()} bg-danger text-white`} title="Hapus PDF">
                        <Check size={12} weight="bold" /> Hapus PDF
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
            <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) { handlePdfUpload(file); e.target.value = ''; }
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
                .tiptap h1 { font-size: 28px; font-weight: 700; margin: 24px 0 12px 0; color: var(--text-1); }
                .tiptap h2 { font-size: 22px; font-weight: 600; margin: 20px 0 10px 0; color: var(--text-1); }
                .tiptap h3 { font-size: 18px; font-weight: 600; margin: 16px 0 8px 0; color: var(--text-1); }
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
                    outline: 3px solid var(--accent);
                    outline-offset: 4px;
                }
                .tiptap img[data-align="left"] { margin-left: 0; margin-right: auto; }
                .tiptap img[data-align="center"] { margin-left: auto; margin-right: auto; display: block; }
                .tiptap img[data-align="right"] { margin-left: auto; margin-right: 0; display: block; }
                .tiptap a { color: var(--accent); text-decoration: underline; }
                .tiptap p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left; color: var(--text-muted);
                    pointer-events: none; height: 0;
                }
                /* PDF placeholder block: token-native dashed token, name via CSS
                   content so the node collapses to exactly the saved markup. */
                .tiptap div[data-pdf] {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 14px 0;
                    padding: 14px 18px;
                    border: 1.5px dashed var(--border);
                    border-radius: 8px;
                    background: var(--surface-2);
                    color: var(--text-1);
                    font-size: 13px;
                    line-height: 1.5;
                }
                .tiptap div[data-pdf]::before {
                    content: "PDF — " attr(data-filename);
                    font-weight: 600;
                    color: var(--text-1);
                }
                /* Transient failed-upload state: red border + red message.
                   The data-pdf-error attr never survives server sanitization. */
                .tiptap div[data-pdf][data-pdf-error] {
                    border-color: var(--color-danger);
                    border-style: solid;
                }
                .tiptap div[data-pdf][data-pdf-error]::before {
                    content: "Gagal unggah: " attr(data-filename);
                    color: var(--color-danger);
                }
                .tiptap div[data-pdf].ProseMirror-selectednode {
                    outline: 2px solid var(--brand-red);
                    outline-offset: 2px;
                }
                .rich-editor-pdf-menu-item:hover {
                    background: var(--surface-2);
                }
            `}</style>

            {/* ── YouTube dialog ── */}
            {showYoutubeDialog && (
                <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/70 animate-modal-fade"
                    onClick={() => { setShowYoutubeDialog(false); setYoutubeUrl(''); }}
                >
                    <div className="w-full max-w-sm rounded-card border border-border bg-surface-3 p-6 animate-modal-scale"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-1">
                                <YoutubeLogo size={18} className="text-accent" /> Embed YouTube Video
                            </h3>
                            <button type="button"
                                onClick={() => { setShowYoutubeDialog(false); setYoutubeUrl(''); }}
                                className="cursor-pointer rounded p-1 text-text-3 transition-colors duration-150 hover:bg-surface-2 hover:text-text-1"
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
                            className="mb-2 w-full rounded-control border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-1 outline-none transition-colors duration-150 focus:border-accent"
                            autoFocus
                        />
                        <p className="mb-4 text-xs text-text-3">
                            Format: youtube.com/watch?v=XXX atau youtu.be/XXX
                        </p>
                        <div className="flex justify-end gap-2">
                            <button type="button"
                                onClick={() => { setShowYoutubeDialog(false); setYoutubeUrl(''); }}
                                className="cursor-pointer rounded-control border border-border px-4 py-2 text-sm text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text-1"
                            >
                                Batal
                            </button>
                            <button type="button" onClick={insertYoutube} disabled={!youtubeUrl}
                                className="rounded-control bg-santos-red-dark px-4 py-2 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Embed
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── PDF URL dialog ── */}
            {showPdfUrlDialog && (
                <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/70 animate-modal-fade"
                    onClick={() => { setShowPdfUrlDialog(false); setPdfUrl(''); }}
                >
                    <div className="w-full max-w-sm rounded-card border border-border bg-surface-3 p-6 animate-modal-scale"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-1">
                                <FilePdf size={18} className="text-accent" /> Sisipkan PDF via URL
                            </h3>
                            <button type="button"
                                onClick={() => { setShowPdfUrlDialog(false); setPdfUrl(''); }}
                                className="cursor-pointer rounded p-1 text-text-3 transition-colors duration-150 hover:bg-surface-2 hover:text-text-1"
                                aria-label="Tutup"
                            >
                                <Minus size={18} weight="bold" />
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="Paste URL PDF (https://.../*.pdf)"
                            value={pdfUrl}
                            onChange={(e) => setPdfUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && insertPdfUrl()}
                            className="mb-2 w-full rounded-control border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-1 outline-none transition-colors duration-150 focus:border-accent"
                            autoFocus
                        />
                        <p className="mb-4 text-xs text-text-3">
                            Format: https://domain.com/berkas/contoh.pdf (hanya http/https yang diizinkan)
                        </p>
                        <div className="flex justify-end gap-2">
                            <button type="button"
                                onClick={() => { setShowPdfUrlDialog(false); setPdfUrl(''); }}
                                className="cursor-pointer rounded-control border border-border px-4 py-2 text-sm text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text-1"
                            >
                                Batal
                            </button>
                            <button type="button" onClick={insertPdfUrl} disabled={!pdfUrl}
                                className="rounded-control bg-santos-red-dark px-4 py-2 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Sisipkan
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
                    } else if (type === "pdf") {
                        // WR-04: PDF dari library → blok PDF utuh, bukan <img> rusak.
                        const filename = url.split('/').filter(Boolean).pop() || 'dokumen.pdf';
                        editor?.chain().focus().insertContent({
                            type: 'pdf',
                            attrs: { src: url, filename },
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
