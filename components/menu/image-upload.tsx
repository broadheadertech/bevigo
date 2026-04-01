"use client";

import { useState, useRef } from"react";
import { useMutation } from"convex/react";
import { api } from"../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { Id } from"../../convex/_generated/dataModel";

type ImageUploadProps = {
 itemId: Id<"menuItems">;
 currentImageUrl?: string | null;
 onUploaded?: () => void;
};

export function ImageUpload({ itemId, currentImageUrl, onUploaded }: ImageUploadProps) {
 const { token } = useAuth();
 const generateUploadUrl = useMutation(api.menu.imageMutations.generateUploadUrl);
 const setItemImage = useMutation(api.menu.imageMutations.setItemImage);
 const removeItemImage = useMutation(api.menu.imageMutations.removeItemImage);

 const [isUploading, setIsUploading] = useState(false);
 const [preview, setPreview] = useState<string | null>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);

 const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file || !token) return;

 // Preview
 const reader = new FileReader();
 reader.onload = () => setPreview(reader.result as string);
 reader.readAsDataURL(file);

 // Upload
 setIsUploading(true);
 try {
 const uploadUrl = await generateUploadUrl({ token });
 const result = await fetch(uploadUrl, {
 method:"POST",
 headers: {"Content-Type": file.type },
 body: file,
 });
 const { storageId } = await result.json();

 await setItemImage({
 token,
 itemId,
 imageId: storageId,
 });

 onUploaded?.();
 } catch (err) {
 console.error("Upload failed:", err);
 } finally {
 setIsUploading(false);
 }
 };

 const handleRemove = async () => {
 if (!token) return;
 setIsUploading(true);
 try {
 await removeItemImage({ token, itemId });
 setPreview(null);
 onUploaded?.();
 } catch (err) {
 console.error("Remove failed:", err);
 } finally {
 setIsUploading(false);
 }
 };

 const displayUrl = preview || currentImageUrl;

 return (
 <div>
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 onChange={handleFileSelect}
 className="hidden"
 />

 {displayUrl ? (
 <div className="relative w-full h-32 rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--muted)' }}>
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={displayUrl}
 alt="Product"
 className="w-full h-full object-cover"
 />
 <div className="absolute inset-0 bg-black/0 hover:bg-black/50 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
 <button
 onClick={() => fileInputRef.current?.click()}
 disabled={isUploading}
 className="px-3 py-1.5/90 text-xs font-medium rounded-2xl"
 >
 Change
 </button>
 <button
 onClick={handleRemove}
 disabled={isUploading}
 className="px-3 py-1.5 bg-red-500/90 text-white text-xs font-medium rounded-2xl"
 >
 Remove
 </button>
 </div>
 {isUploading && (
 <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
 <span className="text-white text-sm">Uploading...</span>
 </div>
 )}
 </div>
 ) : (
 <button
 onClick={() => fileInputRef.current?.click()}
 disabled={isUploading}
 className="w-full h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors"
 style={{ borderColor: 'var(--border-color)', color: 'var(--muted-fg)' }}
 >
 <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M6.75 12a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
 </svg>
 <span className="text-xs font-medium">
 {isUploading ?"Uploading..." :"Add Image"}
 </span>
 </button>
 )}
 </div>
 );
}
