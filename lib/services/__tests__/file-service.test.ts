import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FileServiceError,
  uploadToCloudinary,
  deleteFromCloudinary,
  createAttachment,
  getAttachments,
  deleteAttachment,
  uploadFile,
  uploadFiles,
  removeFile,
} from '../file-service';

// Mock global fetch
global.fetch = vi.fn();

describe('file-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('FileServiceError', () => {
    it('creates error with message and status code', () => {
      const error = new FileServiceError('Test error', 400);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('FileServiceError');
    });

    it('creates error with original error', () => {
      const originalError = new Error('Original');
      const error = new FileServiceError('Test', 500, originalError);
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('uploadToCloudinary', () => {
    it('uploads file successfully', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const mockResponse = {
        success: true,
        data: {
          publicId: 'test-id',
          url: 'http://test.com/test.jpg',
          secureUrl: 'https://test.com/test.jpg',
          format: 'jpg',
          width: 100,
          height: 100,
          bytes: 1024,
          fileName: 'test.jpg',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await uploadToCloudinary(mockFile);

      expect(result).toEqual(mockResponse.data);
      expect(global.fetch).toHaveBeenCalledWith('/api/upload', {
        method: 'POST',
        body: expect.any(FormData),
      });
    });

    it('throws FileServiceError on upload failure', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Upload failed' }),
      });

      await expect(uploadToCloudinary(mockFile)).rejects.toThrow(FileServiceError);
    });

    it('throws default error message when response has no error field', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(uploadToCloudinary(mockFile)).rejects.toThrow('파일 업로드 실패');
    });
  });

  describe('deleteFromCloudinary', () => {
    it('deletes file successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await deleteFromCloudinary('test-id');

      expect(global.fetch).toHaveBeenCalledWith('/api/upload/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId: 'test-id' }),
      });
    });

    it('throws FileServiceError on delete failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'File not found' }),
      });

      await expect(deleteFromCloudinary('test-id')).rejects.toThrow(FileServiceError);
    });
  });

  describe('createAttachment', () => {
    it('creates attachment successfully', async () => {
      const fileData = {
        publicId: 'test-id',
        url: 'http://test.com/test.jpg',
        secureUrl: 'https://test.com/test.jpg',
        format: 'jpg',
        fileName: 'test.jpg',
        fileSize: 1024,
      };

      const mockResponse = {
        id: 'attachment-id',
        expenseId: 'expense-1',
        ...fileData,
        createdAt: new Date().toISOString(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createAttachment('expense-1', fileData);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith('/api/expenses/expense-1/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fileData),
      });
    });

    it('throws FileServiceError on creation failure', async () => {
      const fileData = {
        publicId: 'test-id',
        url: 'http://test.com/test.jpg',
        secureUrl: 'https://test.com/test.jpg',
        format: 'jpg',
        fileName: 'test.jpg',
        fileSize: 1024,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid data' }),
      });

      await expect(createAttachment('expense-1', fileData)).rejects.toThrow(FileServiceError);
    });
  });

  describe('getAttachments', () => {
    it('retrieves attachments successfully', async () => {
      const mockAttachments = [
        {
          id: 'att-1',
          expenseId: 'expense-1',
          publicId: 'test-id-1',
          url: 'http://test.com/1.jpg',
          secureUrl: 'https://test.com/1.jpg',
          format: 'jpg',
          fileName: 'test1.jpg',
          fileSize: 1024,
          createdAt: new Date().toISOString(),
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAttachments,
      });

      const result = await getAttachments('expense-1');

      expect(result).toEqual(mockAttachments);
      expect(global.fetch).toHaveBeenCalledWith('/api/expenses/expense-1/attachments');
    });

    it('throws FileServiceError on retrieval failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Expense not found' }),
      });

      await expect(getAttachments('expense-1')).rejects.toThrow(FileServiceError);
    });
  });

  describe('deleteAttachment', () => {
    it('deletes attachment successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'Deleted successfully',
        cloudinaryDeleted: true,
        attachmentId: 'att-1',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await deleteAttachment('expense-1', 'att-1');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/expenses/expense-1/attachments/att-1',
        { method: 'DELETE' }
      );
    });

    it('throws FileServiceError on deletion failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Attachment not found' }),
      });

      await expect(deleteAttachment('expense-1', 'att-1')).rejects.toThrow(FileServiceError);
    });
  });

  describe('uploadFile', () => {
    it('uploads file to Cloudinary only when no expenseId', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const cloudinaryData = {
        publicId: 'test-id',
        url: 'http://test.com/test.jpg',
        secureUrl: 'https://test.com/test.jpg',
        format: 'jpg',
        width: 100,
        height: 100,
        bytes: 1024,
        fileName: 'test.jpg',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: cloudinaryData }),
      });

      const result = await uploadFile(mockFile);

      expect(result.publicId).toBe('test-id');
      expect(result.id).toBeUndefined();
    });

    it('uploads file to Cloudinary and DB when expenseId provided', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const cloudinaryData = {
        publicId: 'test-id',
        url: 'http://test.com/test.jpg',
        secureUrl: 'https://test.com/test.jpg',
        format: 'jpg',
        width: 100,
        height: 100,
        bytes: 1024,
        fileName: 'test.jpg',
      };

      const attachmentData = {
        id: 'att-1',
        expenseId: 'expense-1',
        ...cloudinaryData,
        createdAt: new Date().toISOString(),
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: cloudinaryData }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => attachmentData,
        });

      const result = await uploadFile(mockFile, 'expense-1');

      expect(result.id).toBe('att-1');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('cleans up Cloudinary file when DB save fails', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const cloudinaryData = {
        publicId: 'test-id',
        url: 'http://test.com/test.jpg',
        secureUrl: 'https://test.com/test.jpg',
        format: 'jpg',
        width: 100,
        height: 100,
        bytes: 1024,
        fileName: 'test.jpg',
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: cloudinaryData }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: 'DB save failed' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      await expect(uploadFile(mockFile, 'expense-1')).rejects.toThrow(FileServiceError);

      // Verify cleanup was attempted
      expect(global.fetch).toHaveBeenCalledWith('/api/upload/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId: 'test-id' }),
      });
    });
  });

  describe('uploadFiles', () => {
    it('uploads multiple files successfully', async () => {
      const files = [
        new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['test2'], 'test2.jpg', { type: 'image/jpeg' }),
      ];

      const mockData = (id: string) => ({
        publicId: id,
        url: `http://test.com/${id}.jpg`,
        secureUrl: `https://test.com/${id}.jpg`,
        format: 'jpg',
        width: 100,
        height: 100,
        bytes: 1024,
        fileName: `${id}.jpg`,
      });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: mockData('test1') }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: mockData('test2') }),
        });

      const result = await uploadFiles(files);

      expect(result.succeeded).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it('handles partial failures', async () => {
      const files = [
        new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['test2'], 'test2.jpg', { type: 'image/jpeg' }),
      ];

      const mockData = {
        publicId: 'test1',
        url: 'http://test.com/test1.jpg',
        secureUrl: 'https://test.com/test1.jpg',
        format: 'jpg',
        width: 100,
        height: 100,
        bytes: 1024,
        fileName: 'test1.jpg',
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: mockData }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Upload failed' }),
        });

      const result = await uploadFiles(files);

      expect(result.succeeded).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].file).toBe(files[1]);
    });
  });

  describe('removeFile', () => {
    it('removes file from DB and Cloudinary when both IDs provided', async () => {
      const file = {
        id: 'att-1',
        publicId: 'test-id',
        url: 'http://test.com/test.jpg',
        secureUrl: 'https://test.com/test.jpg',
        format: 'jpg',
        fileName: 'test.jpg',
        fileSize: 1024,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await removeFile(file, 'expense-1');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/expenses/expense-1/attachments/att-1',
        { method: 'DELETE' }
      );
    });

    it('removes file from Cloudinary only when no DB ID', async () => {
      const file = {
        publicId: 'test-id',
        url: 'http://test.com/test.jpg',
        secureUrl: 'https://test.com/test.jpg',
        format: 'jpg',
        fileName: 'test.jpg',
        fileSize: 1024,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await removeFile(file);

      expect(global.fetch).toHaveBeenCalledWith('/api/upload/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId: 'test-id' }),
      });
    });
  });
});
