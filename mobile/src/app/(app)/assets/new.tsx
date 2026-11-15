import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  UploadCloud,
  FileText,
  Music,
  Image as ImageIcon,
  Type as TypeIcon,
  Check,
  X,
  AlertCircle,
} from 'lucide-react-native';
import { useUploadAssetMutation } from '../../../hooks/mutations/useAssetMutations';
import { useToast } from '../../../providers/ToastProvider';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Badge } from '../../../components/ui/Badge';
import { tokens } from '../../../design/tokens';
import { formatBytes } from '../../../lib/format';
import { AssetType, AssetStatus, LicenseStatus } from '../../../types/domain';

const ASSET_TYPES: AssetType[] = [
  'Background',
  'Font',
  'Music',
  'Logo',
  'Watermark',
  'Icon',
];

interface SelectedFileInfo {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

export default function AssetUploadScreen() {
  const router = useRouter();
  const toast = useToast();
  const uploadMutation = useUploadAssetMutation();

  const [type, setType] = useState<AssetType>('Background');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<AssetStatus>('Active');
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>('Confirmed');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedFile, setSelectedFile] = useState<SelectedFileInfo | null>(null);

  const [nameError, setNameError] = useState('');
  const [fileError, setFileError] = useState('');
  const [timeError, setTimeError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  const isImageTarget = (targetType: AssetType) => {
    return ['Background', 'Logo', 'Watermark', 'Icon'].includes(targetType);
  };

  const handlePickFile = async () => {
    setFileError('');
    try {
      if (isImageTarget(type)) {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 1,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const picked = result.assets[0];
          if (!picked) return;
          const uri = picked.uri;
          const fileName =
            picked.fileName || uri.split('/').pop() || `${type.toLowerCase()}-upload.png`;
          const mimeType = picked.mimeType || 'image/png';

          setSelectedFile({
            uri,
            name: fileName,
            mimeType,
            size: picked.fileSize,
          });

          if (!name.trim()) {
            const baseName = fileName.replace(/\.[^/.]+$/, '');
            setName(baseName);
            setNameError('');
          }
        }
      } else if (type === 'Music') {
        const result = await DocumentPicker.getDocumentAsync({
          type: 'audio/*',
          copyToCacheDirectory: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const picked = result.assets[0];
          if (!picked) return;
          setSelectedFile({
            uri: picked.uri,
            name: picked.name,
            mimeType: picked.mimeType || 'audio/mpeg',
            size: picked.size,
          });

          if (!name.trim()) {
            const baseName = picked.name.replace(/\.[^/.]+$/, '');
            setName(baseName);
            setNameError('');
          }
        }
      } else {
        // Font
        const result = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const picked = result.assets[0];
          if (!picked) return;
          setSelectedFile({
            uri: picked.uri,
            name: picked.name,
            mimeType: picked.mimeType || 'font/ttf',
            size: picked.size,
          });

          if (!name.trim()) {
            const baseName = picked.name.replace(/\.[^/.]+$/, '');
            setName(baseName);
            setNameError('');
          }
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to select file');
    }
  };

  const handleTypeSelect = (newType: AssetType) => {
    if (newType !== type) {
      setType(newType);
      // Reset selected file if switching between image, music, and font categories
      if (
        (isImageTarget(type) && !isImageTarget(newType)) ||
        (!isImageTarget(type) && isImageTarget(newType)) ||
        type === 'Music' ||
        newType === 'Music'
      ) {
        setSelectedFile(null);
      }
      setTimeError('');
    }
  };

  const handleUpload = () => {
    let hasError = false;

    if (!selectedFile) {
      setFileError('Please select a file to upload');
      hasError = true;
    }

    if (!name.trim()) {
      setNameError('Asset name is required');
      hasError = true;
    }

    if (type === 'Music') {
      const startNum = startTime.trim() !== '' ? Number(startTime) : undefined;
      const endNum = endTime.trim() !== '' ? Number(endTime) : undefined;

      if (startNum !== undefined && (isNaN(startNum) || startNum < 0)) {
        setTimeError('Start time must be 0 or a positive number');
        hasError = true;
      } else if (
        startNum !== undefined &&
        endNum !== undefined &&
        !isNaN(startNum) &&
        !isNaN(endNum)
      ) {
        if (endNum <= startNum) {
          setTimeError('End time must be greater than start time');
          hasError = true;
        } else if (endNum - startNum > 15.05) {
          setTimeError('Music segment cannot exceed 15 seconds');
          hasError = true;
        } else {
          setTimeError('');
        }
      } else {
        setTimeError('');
      }
    }

    if (hasError || !selectedFile) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', {
      uri: selectedFile.uri,
      name: selectedFile.name,
      type: selectedFile.mimeType,
    } as any);

    formData.append('name', name.trim());
    formData.append('type', type);
    formData.append('status', status);
    formData.append('licenseStatus', licenseStatus);

    if (type === 'Music') {
      if (startTime.trim() !== '') {
        formData.append('startTime', startTime.trim());
      }
      if (endTime.trim() !== '') {
        formData.append('endTime', endTime.trim());
      }
    }

    uploadMutation.mutate(
      {
        formData,
        signal: controller.signal,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.min(
              100,
              Math.round((progressEvent.loaded * 100) / progressEvent.total)
            );
            setUploadProgress(percent);
          }
        },
      },
      {
        onSuccess: () => {
          router.back();
        },
        onSettled: () => {
          abortControllerRef.current = null;
        },
      }
    );
  };

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setUploadProgress(0);
      toast.info('Upload cancelled');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Asset Type Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Asset Type</Text>
          <View style={styles.typeGrid}>
            {ASSET_TYPES.map((t) => {
              const isSelected = type === t;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="button"
                  accessibilityLabel={`Select asset type ${t}`}
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.typeChip,
                    isSelected && styles.typeChipSelected,
                  ]}
                  onPress={() => handleTypeSelect(t)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      isSelected && styles.typeChipTextSelected,
                    ]}
                  >
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* File Picker Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            File <Text style={styles.requiredAsterisk}>*</Text>
          </Text>

          {selectedFile ? (
            <Card style={styles.fileSelectedCard}>
              <View style={styles.fileSelectedHeader}>
                <View style={styles.fileIconWrapper}>
                  {type === 'Music' ? (
                    <Music size={22} color={tokens.colors.primaryLight} />
                  ) : type === 'Font' ? (
                    <TypeIcon size={22} color={tokens.colors.primaryLight} />
                  ) : (
                    <ImageIcon size={22} color={tokens.colors.primaryLight} />
                  )}
                </View>
                <View style={styles.fileDetails}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                  <Text style={styles.fileMeta}>
                    {selectedFile.size !== undefined
                      ? formatBytes(selectedFile.size)
                      : selectedFile.mimeType}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Remove selected file"
                  onPress={() => setSelectedFile(null)}
                  disabled={uploadMutation.isPending}
                  style={styles.removeFileBtn}
                >
                  <X size={18} color={tokens.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Button
                variant="outline"
                size="sm"
                onPress={handlePickFile}
                disabled={uploadMutation.isPending}
              >
                Change File
              </Button>
            </Card>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select file to upload"
              style={[
                styles.dropzoneContainer,
                Boolean(fileError) && styles.dropzoneError,
              ]}
              onPress={handlePickFile}
            >
              <UploadCloud size={32} color={tokens.colors.primaryLight} />
              <Text style={styles.dropzoneTitle}>
                {type === 'Music'
                  ? 'Select Audio File'
                  : type === 'Font'
                  ? 'Select Font File'
                  : 'Select Image File'}
              </Text>
              <Text style={styles.dropzoneSubtitle}>
                {type === 'Music'
                  ? 'MP3, WAV, or AAC'
                  : type === 'Font'
                  ? 'TTF, OTF, or WOFF'
                  : 'PNG, JPG, or WebP'}
              </Text>
              <Button
                variant="secondary"
                size="sm"
                style={{ marginTop: tokens.spacing.sm }}
                onPress={handlePickFile}
              >
                Browse Files
              </Button>
            </Pressable>
          )}

          {fileError ? (
            <View style={styles.errorRow}>
              <AlertCircle size={14} color={tokens.colors.destructiveLight} />
              <Text style={styles.errorText}>{fileError}</Text>
            </View>
          ) : null}
        </View>

        {/* Asset Name */}
        <Field
          label="Asset Name"
          required
          placeholder="e.g. Modern Minimalist Theme"
          value={name}
          onChangeText={(val) => {
            setName(val);
            if (nameError) setNameError('');
          }}
          error={nameError}
          editable={!uploadMutation.isPending}
        />

        {/* Music-Specific Segment Fields */}
        {type === 'Music' && (
          <Card style={styles.musicConfigCard}>
            <Text style={styles.musicConfigTitle}>Audio Trimming</Text>
            <Text style={styles.musicConfigDesc}>
              Specify playback segment in seconds (maximum 15 seconds duration).
            </Text>

            <View style={styles.timeInputsRow}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Start Time (sec)"
                  placeholder="0"
                  keyboardType="numeric"
                  value={startTime}
                  onChangeText={(val) => {
                    setStartTime(val);
                    if (timeError) setTimeError('');
                  }}
                  editable={!uploadMutation.isPending}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="End Time (sec)"
                  placeholder="15"
                  keyboardType="numeric"
                  value={endTime}
                  onChangeText={(val) => {
                    setEndTime(val);
                    if (timeError) setTimeError('');
                  }}
                  editable={!uploadMutation.isPending}
                />
              </View>
            </View>

            {timeError ? (
              <View style={styles.errorRow}>
                <AlertCircle size={14} color={tokens.colors.destructiveLight} />
                <Text style={styles.errorText}>{timeError}</Text>
              </View>
            ) : null}
          </Card>
        )}

        {/* Status Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Status</Text>
          <View style={styles.chipsRow}>
            {(['Active', 'Disabled'] as AssetStatus[]).map((s) => {
              const isSelected = status === s;
              return (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityLabel={`Set status to ${s}`}
                  style={[
                    styles.statusChip,
                    isSelected && styles.statusChipSelected,
                  ]}
                  onPress={() => setStatus(s)}
                  disabled={uploadMutation.isPending}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      isSelected && styles.statusChipTextSelected,
                    ]}
                  >
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* License Status Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>License Status</Text>
          <View style={styles.chipsRow}>
            {(['Confirmed', 'Unconfirmed'] as LicenseStatus[]).map((ls) => {
              const isSelected = licenseStatus === ls;
              return (
                <Pressable
                  key={ls}
                  accessibilityRole="button"
                  accessibilityLabel={`Set license status to ${ls}`}
                  style={[
                    styles.statusChip,
                    isSelected && styles.statusChipSelected,
                  ]}
                  onPress={() => setLicenseStatus(ls)}
                  disabled={uploadMutation.isPending}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      isSelected && styles.statusChipTextSelected,
                    ]}
                  >
                    {ls}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Upload Progress Bar */}
        {uploadMutation.isPending && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Uploading Asset...</Text>
              <Text style={styles.progressValue}>{uploadProgress}%</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${uploadProgress}%` },
                ]}
              />
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          {uploadMutation.isPending ? (
            <Button
              variant="danger"
              onPress={handleCancelUpload}
              icon={X}
            >
              Cancel Upload
            </Button>
          ) : (
            <>
              <Button
                variant="primary"
                onPress={handleUpload}
                isLoading={uploadMutation.isPending}
                loadingText="Uploading..."
                icon={UploadCloud}
              >
                Upload Asset
              </Button>
              <Button
                variant="ghost"
                onPress={() => router.back()}
              >
                Cancel
              </Button>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bgApp,
  },
  scrollContent: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.lg,
    paddingBottom: 48,
  },
  section: {
    gap: tokens.spacing.sm,
  },
  sectionLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600',
    color: tokens.colors.textMuted,
    textTransform: 'uppercase',
  },
  requiredAsterisk: {
    color: tokens.colors.destructiveLight,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  typeChip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  typeChipSelected: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primaryLight,
  },
  typeChipText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600',
    color: tokens.colors.textMuted,
  },
  typeChipTextSelected: {
    color: tokens.colors.text,
  },
  dropzoneContainer: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 2,
    borderColor: tokens.colors.border,
    borderStyle: 'dashed',
    borderRadius: tokens.radius.card,
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
  },
  dropzoneError: {
    borderColor: tokens.colors.destructiveLight,
  },
  dropzoneTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '700',
    color: tokens.colors.text,
    marginTop: tokens.spacing.xs,
  },
  dropzoneSubtitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
  },
  fileSelectedCard: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.md,
  },
  fileSelectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  fileIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  fileMeta: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
    marginTop: tokens.spacing.xxs,
  },
  removeFileBtn: {
    padding: tokens.spacing.xs,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.xxs,
  },
  errorText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.destructiveLight,
  },
  musicConfigCard: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.sm,
    backgroundColor: tokens.colors.surfaceRaised,
  },
  musicConfigTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  musicConfigDesc: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  statusChip: {
    flex: 1,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.button,
  },
  statusChipSelected: {
    backgroundColor: tokens.colors.surfaceRaised,
    borderColor: tokens.colors.primaryLight,
  },
  statusChipText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '600',
    color: tokens.colors.textMuted,
  },
  statusChipTextSelected: {
    color: tokens.colors.primaryLight,
  },
  progressContainer: {
    gap: tokens.spacing.xs,
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.base,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  progressValue: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '700',
    color: tokens.colors.primaryLight,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceRaised,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.pill,
  },
  actionButtonsContainer: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
});
