import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { uploadImage, deleteImage, deleteImages } from '../cloudinary';

// Mock cloudinary
vi.mock('cloudinary', () => {
  const mockUploadStream = vi.fn();
  const mockDestroy = vi.fn();
  const mockDeleteResources = vi.fn();

  return {
    v2: {
      config: vi.fn(),
      uploader: {
        upload_stream: mockUploadStream,
        destroy: mockDestroy,
      },
      api: {
        delete_resources: mockDeleteResources,
      },
    },
  };
});

import { v2 as cloudinary } from 'cloudinary';

describe('cloudinary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadImage', () => {
    it('uploads image successfully with default options', async () => {
      const mockResult = {
        public_id: 'test-id',
        secure_url: 'https://test.com/image.jpg',
        url: 'http://test.com/image.jpg',
        format: 'jpg',
      };

      const mockStream = {
        end: vi.fn(),
      };

      (cloudinary.uploader.upload_stream as Mock).mockImplementation((options, callback) => {
        // Simulate successful upload
        setTimeout(() => callback(null, mockResult), 0);
        return mockStream;
      });

      const buffer = Buffer.from('test image data');
      const result = await uploadImage(buffer, 'test.jpg');

      expect(result).toEqual(mockResult);
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'expense-receipts',
          resource_type: 'auto',
        }),
        expect.any(Function)
      );
      expect(mockStream.end).toHaveBeenCalledWith(buffer);
    });

    it('uploads image with custom options', async () => {
      const mockResult = {
        public_id: 'custom-id',
        secure_url: 'https://test.com/custom.jpg',
      };

      const mockStream = {
        end: vi.fn(),
      };

      (cloudinary.uploader.upload_stream as Mock).mockImplementation((options, callback) => {
        setTimeout(() => callback(null, mockResult), 0);
        return mockStream;
      });

      const buffer = Buffer.from('test');
      const customOptions = {
        folder: 'custom-folder',
        resource_type: 'image' as const,
        transformation: [{ width: 500, crop: 'limit' }],
      };

      await uploadImage(buffer, 'custom.jpg', customOptions);

      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'custom-folder',
          resource_type: 'image',
          transformation: customOptions.transformation,
        }),
        expect.any(Function)
      );
    });

    it('rejects on upload error', async () => {
      const mockError = new Error('Upload failed');
      const mockStream = {
        end: vi.fn(),
      };

      (cloudinary.uploader.upload_stream as Mock).mockImplementation((options, callback) => {
        setTimeout(() => callback(mockError, null), 0);
        return mockStream;
      });

      const buffer = Buffer.from('test');

      await expect(uploadImage(buffer, 'test.jpg')).rejects.toThrow('Upload failed');
    });

    it('generates unique public_id with timestamp', async () => {
      const mockStream = {
        end: vi.fn(),
      };

      let capturedOptions: any;
      (cloudinary.uploader.upload_stream as Mock).mockImplementation((options, callback) => {
        capturedOptions = options;
        setTimeout(() => callback(null, {}), 0);
        return mockStream;
      });

      const buffer = Buffer.from('test');
      await uploadImage(buffer, 'test.jpg');

      expect(capturedOptions.public_id).toMatch(/^\d+-test\.jpg$/);
    });
  });

  describe('deleteImage', () => {
    it('deletes image successfully', async () => {
      const mockResult = {
        result: 'ok',
      };

      (cloudinary.uploader.destroy as Mock).mockResolvedValue(mockResult);

      const result = await deleteImage('test-public-id');

      expect(result).toEqual(mockResult);
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('test-public-id');
    });

    it('throws error on delete failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockError = new Error('Delete failed');
      (cloudinary.uploader.destroy as Mock).mockRejectedValue(mockError);

      await expect(deleteImage('test-id')).rejects.toThrow('Delete failed');

      consoleSpy.mockRestore();
    });

    it('logs error to console on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockError = new Error('Delete failed');
      (cloudinary.uploader.destroy as Mock).mockRejectedValue(mockError);

      try {
        await deleteImage('test-id');
      } catch (e) {
        // Expected error
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error deleting image from Cloudinary:',
        mockError
      );

      consoleSpy.mockRestore();
    });
  });

  describe('deleteImages', () => {
    it('deletes multiple images successfully', async () => {
      const mockResult = {
        deleted: {
          'id-1': 'deleted',
          'id-2': 'deleted',
        },
      };

      (cloudinary.api.delete_resources as Mock).mockResolvedValue(mockResult);

      const publicIds = ['id-1', 'id-2'];
      const result = await deleteImages(publicIds);

      expect(result).toEqual(mockResult);
      expect(cloudinary.api.delete_resources).toHaveBeenCalledWith(publicIds);
    });

    it('throws error on batch delete failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockError = new Error('Batch delete failed');
      (cloudinary.api.delete_resources as Mock).mockRejectedValue(mockError);

      await expect(deleteImages(['id-1', 'id-2'])).rejects.toThrow('Batch delete failed');

      consoleSpy.mockRestore();
    });

    it('logs error to console on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockError = new Error('Batch delete failed');
      (cloudinary.api.delete_resources as Mock).mockRejectedValue(mockError);

      try {
        await deleteImages(['id-1']);
      } catch (e) {
        // Expected error
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error deleting images from Cloudinary:',
        mockError
      );

      consoleSpy.mockRestore();
    });

    it('handles empty array', async () => {
      const mockResult = { deleted: {} };
      (cloudinary.api.delete_resources as Mock).mockResolvedValue(mockResult);

      const result = await deleteImages([]);

      expect(result).toEqual(mockResult);
      expect(cloudinary.api.delete_resources).toHaveBeenCalledWith([]);
    });
  });
});
