"use client";

import { useEditor, EditorContent, Node, mergeAttributes } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useRef, useState, useEffect } from "react";
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
    FiYoutube,
    FiX,
    FiVideo,
    FiFolder,
} from "react-icons/fi";
import { LuHeading1, LuHeading2, LuHeading3, LuListOrdered } from "react-icons/lu";
import MediaPickerModal from "./MediaPickerModal";

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
            // Also update size from current image
            if (isImage) {
                const attrs = editor.getAttributes('image');
                if (attrs.width) setSelectedImageSize(attrs.width);
            }
        },
        onTransaction: ({ editor }) => {
            // Double-check image/video selection on any transaction
            const isImage = editor.isActive('image');
            const isVideo = editor.isActive('video') || editor.isActive('youtube');
            if (isImage !== isImageSelected) {
                setIsImageSelected(isImage);
            }
            if (isVideo !== isVideoSelected) {
                setIsVideoSelected(isVideo);
            }
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

    const handleVideoUpload = useCallback(async (file: File) => {
        if (!editor) return;

        // Validate file type
        if (!file.type.startsWith('video/')) {
            alert('Format file tidak valid. Hanya video yang diperbolehkan.');
            return;
        }

        // Validate file size (max 100MB)
        if (file.size > 100 * 1024 * 1024) {
            alert('Ukuran video terlalu besar. Maksimal 100MB.');
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
            alert(message);
        } finally {
            setIsVideoUploading(false);
        }
    }, [editor]);

    const handleVideoClick = () => {
        videoInputRef.current?.click();
    };

    // Extract YouTube video ID from various URL formats
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
            alert('URL YouTube tidak valid. Gunakan format:\n• youtube.com/watch?v=XXX\n• youtu.be/XXX');
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
        setIsImageSelected(false);
    }, [editor]);

    const deleteVideo = useCallback(() => {
        if (!editor) return;
        editor.chain().focus().deleteSelection().run();
        setIsVideoSelected(false);
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

    const imageButtonStyle = (isActive: boolean = false) => ({
        padding: '6px 10px',
        backgroundColor: isActive ? '#dc2626' : '#1a1a1a',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        fontSize: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        borderRadius: '4px',
    });

    return (
        <div style={{
            backgroundColor: '#0a0a0a',
            border: '1px solid #262626',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '80vh',
        }}>
            {/* Toolbar - Always visible at top */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '2px',
                padding: '8px 12px',
                borderBottom: '1px solid #262626',
                backgroundColor: '#0f0f0f',
                flexShrink: 0,
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

                <div style={dividerStyle} />

                {/* YouTube embed */}
                <button
                    type="button"
                    onClick={() => setShowYoutubeDialog(true)}
                    style={buttonStyle()}
                    title="Embed YouTube Video"
                >
                    <FiYoutube size={16} />
                </button>

                {/* Video upload */}
                <button
                    type="button"
                    onClick={handleVideoClick}
                    disabled={isVideoUploading}
                    style={{
                        ...buttonStyle(),
                        opacity: isVideoUploading ? 0.5 : 1,
                    }}
                    title="Upload Video (MP4, max 100MB)"
                >
                    <FiVideo size={16} />
                </button>

                {isVideoUploading && (
                    <span style={{ color: '#737373', fontSize: '12px' }}>
                        Uploading video...
                    </span>
                )}

                {/* Hint for image resize */}
                <span style={{ color: '#525252', fontSize: '11px', marginLeft: 'auto' }}>
                    💡 Klik gambar untuk resize
                </span>

                {/* Media Library Button */}
                <button
                    type="button"
                    onClick={() => setShowMediaPicker(true)}
                    style={{
                        ...buttonStyle(),
                        marginLeft: '8px',
                        padding: '6px 12px',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        gap: '6px',
                        display: 'flex',
                    }}
                    title="Media Library"
                >
                    <FiFolder size={14} /> Library
                </button>
            </div>

            {/* Image Toolbar - appears when image is selected */}
            {isImageSelected && (
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    borderBottom: '1px solid #262626',
                    backgroundColor: '#171717',
                    flexShrink: 0,
                }}>
                    <span style={{ color: '#a3a3a3', fontSize: '12px', fontWeight: 600 }}>
                        Gambar:
                    </span>

                    {/* Size Controls */}
                    <button
                        type="button"
                        onClick={() => setImageSize('25%')}
                        style={imageButtonStyle(selectedImageSize === '25%')}
                        title="Ukuran 25%"
                    >
                        <FiMinimize size={12} /> 25%
                    </button>
                    <button
                        type="button"
                        onClick={() => setImageSize('50%')}
                        style={imageButtonStyle(selectedImageSize === '50%')}
                        title="Ukuran 50%"
                    >
                        50%
                    </button>
                    <button
                        type="button"
                        onClick={() => setImageSize('75%')}
                        style={imageButtonStyle(selectedImageSize === '75%')}
                        title="Ukuran 75%"
                    >
                        75%
                    </button>
                    <button
                        type="button"
                        onClick={() => setImageSize('100%')}
                        style={imageButtonStyle(selectedImageSize === '100%')}
                        title="Ukuran Penuh"
                    >
                        <FiMaximize size={12} /> 100%
                    </button>

                    {/* Custom Size Input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                            type="number"
                            min="10"
                            max="100"
                            value={parseInt(selectedImageSize) || 100}
                            onChange={(e) => {
                                const val = Math.min(100, Math.max(10, parseInt(e.target.value) || 100));
                                setImageSize(`${val}%`);
                            }}
                            style={{
                                width: '50px',
                                padding: '5px 8px',
                                backgroundColor: '#0a0a0a',
                                border: '1px solid #333',
                                borderRadius: '4px',
                                color: '#fff',
                                fontSize: '12px',
                                textAlign: 'center',
                            }}
                        />
                        <span style={{ color: '#737373', fontSize: '12px' }}>%</span>
                    </div>

                    <div style={{ width: '1px', height: '20px', backgroundColor: '#333' }} />

                    {/* Alignment Controls */}
                    <button
                        type="button"
                        onClick={() => setImageAlign('left')}
                        style={imageButtonStyle()}
                        title="Rata Kiri"
                    >
                        <FiAlignLeft size={14} /> Kiri
                    </button>
                    <button
                        type="button"
                        onClick={() => setImageAlign('center')}
                        style={imageButtonStyle()}
                        title="Rata Tengah"
                    >
                        <FiAlignCenter size={14} /> Tengah
                    </button>
                    <button
                        type="button"
                        onClick={() => setImageAlign('right')}
                        style={imageButtonStyle()}
                        title="Rata Kanan"
                    >
                        <FiAlignRight size={14} /> Kanan
                    </button>

                    <div style={{ width: '1px', height: '20px', backgroundColor: '#333' }} />

                    {/* Delete */}
                    <button
                        type="button"
                        onClick={deleteImage}
                        style={{ ...imageButtonStyle(), backgroundColor: '#7f1d1d' }}
                        title="Hapus Gambar"
                    >
                        <FiTrash2 size={14} /> Hapus
                    </button>
                </div>
            )}

            {/* Video Toolbar - appears when video is selected */}
            {isVideoSelected && (
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    borderBottom: '1px solid #262626',
                    backgroundColor: '#171717',
                    flexShrink: 0,
                }}>
                    <span style={{ color: '#a3a3a3', fontSize: '12px', fontWeight: 600 }}>
                        Video:
                    </span>

                    {/* Delete */}
                    <button
                        type="button"
                        onClick={deleteVideo}
                        style={{ ...imageButtonStyle(), backgroundColor: '#7f1d1d' }}
                        title="Hapus Video"
                    >
                        <FiTrash2 size={14} /> Hapus Video
                    </button>
                </div>
            )}

            {/* Editor Content - Scrollable Area */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: '300px',
            }}>
                <EditorContent editor={editor} />
            </div>

            {/* Hidden file inputs */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
            <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/ogg"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        handleVideoUpload(file);
                        e.target.value = '';
                    }
                }}
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
                    transition: all 0.2s;
                    position: relative;
                }
                .tiptap img:hover {
                    outline: 2px dashed #525252;
                    outline-offset: 4px;
                }
                .tiptap img.ProseMirror-selectednode {
                    outline: 3px solid #dc2626;
                    outline-offset: 4px;
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

            {/* YouTube URL Dialog */}
            {showYoutubeDialog && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100,
                }}>
                    <div style={{
                        backgroundColor: '#171717',
                        border: '1px solid #262626',
                        borderRadius: '8px',
                        padding: '24px',
                        width: '100%',
                        maxWidth: '400px',
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '16px',
                        }}>
                            <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FiYoutube color="#dc2626" /> Embed YouTube Video
                            </h3>
                            <button
                                type="button"
                                onClick={() => { setShowYoutubeDialog(false); setYoutubeUrl(''); }}
                                style={{ background: 'none', border: 'none', color: '#737373', cursor: 'pointer' }}
                            >
                                <FiX size={20} />
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="Paste YouTube URL..."
                            value={youtubeUrl}
                            onChange={(e) => setYoutubeUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && insertYoutube()}
                            style={{
                                width: '100%',
                                padding: '12px',
                                backgroundColor: '#0a0a0a',
                                border: '1px solid #333',
                                borderRadius: '6px',
                                color: '#fff',
                                fontSize: '14px',
                                marginBottom: '12px',
                            }}
                            autoFocus
                        />
                        <p style={{ color: '#737373', fontSize: '11px', marginBottom: '16px' }}>
                            Format: youtube.com/watch?v=XXX atau youtu.be/XXX
                        </p>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => { setShowYoutubeDialog(false); setYoutubeUrl(''); }}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: 'transparent',
                                    border: '1px solid #333',
                                    color: '#a3a3a3',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                }}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={insertYoutube}
                                disabled={!youtubeUrl}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#dc2626',
                                    border: 'none',
                                    color: '#fff',
                                    borderRadius: '6px',
                                    cursor: youtubeUrl ? 'pointer' : 'not-allowed',
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
