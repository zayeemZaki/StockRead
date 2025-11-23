'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';

interface AvatarUploadProps {
  uid: string;
  url: string | null;
  onUpload: (url: string) => void;
  compact?: boolean;
}

export function AvatarUpload({ uid, url, onUpload, compact = false }: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true);

      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      // Validate file is an image
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (max 2MB)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        alert('File size must be less than 2MB');
        return;
      }

      // Create unique file path to avoid cache issues
      const fileExt = file.name.split('.').pop();
      const filePath = `${uid}/${Date.now()}.${fileExt}`;

      console.log('📤 Uploading avatar:', filePath);

      // Upload file to Supabase Storage - preserves original resolution
      // File is uploaded as-is without any resizing or compression
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type // Explicitly set content type to preserve image format
        });

      if (uploadError) {
        console.error('❌ Upload error:', uploadError.message);
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;
      console.log('✅ Avatar uploaded successfully:', publicUrl);

      // Notify parent component
      onUpload(publicUrl);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('🚨 Error uploading avatar:', errorMessage, error);
      alert(`Error uploading avatar: ${errorMessage}`);
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getInitials = (uid: string) => {
    return uid.slice(0, 2).toUpperCase();
  };

  // Compact mode - just the button inline
  if (compact) {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={uploadAvatar}
          className="hidden"
          disabled={isUploading}
        />
        <Button
          onClick={handleFileClick}
          disabled={isUploading}
          variant="outline"
          size="sm"
          className="gap-2 w-fit"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              Change Photo
            </>
          )}
        </Button>
      </>
    );
  }

  // Default full mode
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Avatar Display */}
      <Avatar className="w-32 h-32 border-4 border-primary/50 shadow-xl">
        <AvatarImage src={url || ''} alt="Profile picture" />
        <AvatarFallback className="bg-primary text-primary-foreground text-4xl font-bold">
          {getInitials(uid)}
        </AvatarFallback>
      </Avatar>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={uploadAvatar}
        className="hidden"
        disabled={isUploading}
      />

      {/* Upload Button */}
      <Button
        onClick={handleFileClick}
        disabled={isUploading}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Camera className="w-4 h-4" />
            Change Photo
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Max size: 2MB • Formats: JPG, PNG, GIF
      </p>
    </div>
  );
}
