/**
 * API 에러 핸들러 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import {
  ApiError,
  handleApiError,
  parseJsonRequest,
  validateRequiredFields,
  validateUrl,
  successResponse,
  successMessageResponse,
} from '../error-handler';
import { ERROR_MESSAGES } from '@/lib/constants/error-messages';

describe('ApiError', () => {
  it('should create an ApiError with message and status code', () => {
    const error = new ApiError('Test error', 400);
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('ApiError');
    expect(error).toBeInstanceOf(Error);
  });

  it('should create an ApiError with default status code 500', () => {
    const error = new ApiError('Test error');
    expect(error.statusCode).toBe(500);
  });

  it('should create an ApiError with details', () => {
    const details = { field: 'email', reason: 'invalid format' };
    const error = new ApiError('Test error', 400, details);
    expect(error.details).toEqual(details);
  });
});

describe('handleApiError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should handle ApiError correctly', () => {
    const error = new ApiError('Custom error', 400);
    const response = handleApiError(error);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(400);
    
    const json = response.json() as Promise<any>;
    return json.then((data) => {
      expect(data).toEqual({
        error: 'Custom error',
      });
    });
  });

  it('should handle ApiError with details', () => {
    const details = { field: 'email' };
    const error = new ApiError('Custom error', 400, details);
    const response = handleApiError(error);

    expect(response.status).toBe(400);
    
    const json = response.json() as Promise<any>;
    return json.then((data) => {
      expect(data).toEqual({
        error: 'Custom error',
        details,
      });
    });
  });

  it('should handle Prisma P2002 error (unique constraint)', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint violation', {
      code: 'P2002',
      clientVersion: '7.0.0',
      meta: {
        target: ['email'],
      },
    });

    const response = handleApiError(error);
    expect(response.status).toBe(409);

    const json = response.json() as Promise<any>;
    return json.then((data) => {
      expect(data.error).toBe(ERROR_MESSAGES.RESOURCE_ALREADY_EXISTS);
      expect(data.details).toEqual({ fields: ['email'] });
    });
  });

  it('should handle Prisma P2025 error (record not found)', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.0.0',
    });

    const response = handleApiError(error);
    expect(response.status).toBe(404);

    const json = response.json() as Promise<any>;
    return json.then((data) => {
      expect(data.error).toBe(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    });
  });

  it('should handle Prisma P2003 error (foreign key constraint)', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
      code: 'P2003',
      clientVersion: '7.0.0',
      meta: {
        field_name: 'expenseId',
      },
    });

    const response = handleApiError(error);
    expect(response.status).toBe(404);

    const json = response.json() as Promise<any>;
    return json.then((data) => {
      expect(data.error).toBe(ERROR_MESSAGES.REFERENCED_RESOURCE_NOT_FOUND);
      expect(data.details).toEqual({ field: 'expenseId' });
    });
  });

  it('should handle Prisma P2014 error (invalid relation)', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Invalid relation', {
      code: 'P2014',
      clientVersion: '7.0.0',
    });

    const response = handleApiError(error);
    expect(response.status).toBe(400);

    const json = response.json() as Promise<any>;
    return json.then((data) => {
      expect(data.error).toBe(ERROR_MESSAGES.INVALID_ID);
    });
  });

  it('should handle unknown Prisma error codes', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unknown error', {
      code: 'P9999',
      clientVersion: '7.0.0',
    });

    const response = handleApiError(error);
    expect(response.status).toBe(500);

    const json = response.json() as Promise<any>;
    return json.then((data) => {
      expect(data.error).toBe(ERROR_MESSAGES.INTERNAL_SERVER_ERROR);
      expect(data.details).toEqual({ code: 'P9999' });
    });
  });

  it('should handle Prisma ValidationError', () => {
    const error = new Prisma.PrismaClientValidationError('Validation error', {
      clientVersion: '7.0.0',
    });

    const response = handleApiError(error);
    expect(response.status).toBe(400);

    const json = response.json() as Promise<any>;
    return json.then((data) => {
      expect(data.error).toBe(ERROR_MESSAGES.REQUIRED_FIELDS_MISSING);
      expect(data.details).toBe('Validation error');
    });
  });

  it('should handle SyntaxError (JSON parsing)', () => {
    const error = new SyntaxError('Unexpected token');
    const response = handleApiError(error);
    expect(response.status).toBe(400);

    const json = response.json() as Promise<any>;
    return json.then((data) => {
      expect(data.error).toBe(ERROR_MESSAGES.INVALID_JSON);
    });
  });

  it('should handle Cloudinary error with http_code 404', () => {
    const error = {
      http_code: 404,
      message: 'Image not found',
    };

    const response = handleApiError(error);
    expect(response.status).toBe(404);

    const json = response.json() as Promise<any>;
    return json.then((data) => {
      expect(data.error).toBe(ERROR_MESSAGES.IMAGE_NOT_FOUND);
      expect(data.details).toEqual({ details: 'Image not found' });
    });
  });

  it('should handle Cloudinary error with nested error.http_code', () => {
    const error = {
      error: {
        http_code: 404,
        message: 'Image not found',
      },
    };

    const response = handleApiError(error);
    expect(response.status).toBe(404);

    const json = response.json() as Promise<any>;
    return json.then((data) => {
      expect(data.error).toBe(ERROR_MESSAGES.IMAGE_NOT_FOUND);
    });
  });

  it('should handle Cloudinary error with other http_code', () => {
    const error = {
      http_code: 500,
      message: 'Upload failed',
    };

    const response = handleApiError(error);
    expect(response.status).toBe(500);

    const json = response.json() as Promise<any>;
    return json.then((data) => {
      expect(data.error).toBe(ERROR_MESSAGES.CLOUDINARY_UPLOAD_FAILED);
      expect(data.details).toEqual({
        details: 'Upload failed',
        httpCode: 500,
      });
    });
  });

  it('should handle Cloudinary error with http_code in nested error object', () => {
    const error = {
      error: {
        http_code: 500,
        message: 'Upload failed',
      },
    };

    const response = handleApiError(error);
    expect(response.status).toBe(500);

    const json = response.json() as Promise<any>;
    return json.then((data) => {
      expect(data.error).toBe(ERROR_MESSAGES.CLOUDINARY_UPLOAD_FAILED);
      expect(data.details).toEqual({
        details: undefined,
        httpCode: 500,
      });
    });
  });

  it('should handle Cloudinary error with falsy http_code falling back to nested error', () => {
    const error = {
      http_code: 0, // falsy but not 404
      error: {
        http_code: 500,
        message: 'Upload failed',
      },
    };

    const response = handleApiError(error);
    expect(response.status).toBe(500);

    const json = response.json() as Promise<any>;
    return json.then((data) => {
      expect(data.error).toBe(ERROR_MESSAGES.CLOUDINARY_UPLOAD_FAILED);
      expect(data.details.httpCode).toBe(500);
    });
  });

  it('should handle generic Error', () => {
    const error = new Error('Generic error message');
    const response = handleApiError(error);
    expect(response.status).toBe(500);

    const json = response.json() as Promise<any>;
    return json.then((data) => {
      expect(data.error).toBe(ERROR_MESSAGES.INTERNAL_SERVER_ERROR);
      expect(data.details).toBe('Generic error message');
    });
  });

  it('should handle unknown error types', () => {
    const error = 'String error';
    const response = handleApiError(error);
    expect(response.status).toBe(500);

    const json = response.json() as Promise<any>;
    return json.then((data) => {
      expect(data.error).toBe(ERROR_MESSAGES.UNKNOWN_ERROR);
    });
  });

  it('should handle null error', () => {
    const response = handleApiError(null);
    expect(response.status).toBe(500);

    const json = response.json() as Promise<any>;
    return json.then((data) => {
      expect(data.error).toBe(ERROR_MESSAGES.UNKNOWN_ERROR);
    });
  });

  it('should log errors to console', () => {
    const error = new Error('Test error');
    handleApiError(error);
    expect(console.error).toHaveBeenCalledWith('API Error:', error);
  });
});

describe('parseJsonRequest', () => {
  it('should parse valid JSON request', async () => {
    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'test', value: 123 }),
    });

    const result = await parseJsonRequest(request);
    expect(result).toEqual({ name: 'test', value: 123 });
  });

  it('should throw ApiError for missing Content-Type', async () => {
    const request = new Request('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ name: 'test' }),
    });

    await expect(parseJsonRequest(request)).rejects.toThrow(ApiError);
    await expect(parseJsonRequest(request)).rejects.toThrow(
      ERROR_MESSAGES.INVALID_CONTENT_TYPE
    );
  });

  it('should throw ApiError for non-JSON Content-Type', async () => {
    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: 'test',
    });

    await expect(parseJsonRequest(request)).rejects.toThrow(ApiError);
    await expect(parseJsonRequest(request)).rejects.toThrow(
      ERROR_MESSAGES.INVALID_CONTENT_TYPE
    );
  });

  it('should throw ApiError for invalid JSON body', async () => {
    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: 'invalid json{',
    });

    await expect(parseJsonRequest(request)).rejects.toThrow(ApiError);
    await expect(parseJsonRequest(request)).rejects.toThrow(
      ERROR_MESSAGES.INVALID_JSON
    );
  });

  it('should accept Content-Type with charset', async () => {
    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ test: 'value' }),
    });

    const result = await parseJsonRequest(request);
    expect(result).toEqual({ test: 'value' });
  });
});

describe('validateRequiredFields', () => {
  it('should not throw when all required fields are present', () => {
    const data = {
      name: 'test',
      email: 'test@example.com',
      age: 25,
    };
    const requiredFields = ['name', 'email', 'age'];

    expect(() => validateRequiredFields(data, requiredFields)).not.toThrow();
  });

  it('should throw ApiError when a required field is missing', () => {
    const data = {
      name: 'test',
      email: 'test@example.com',
    };
    const requiredFields = ['name', 'email', 'age'];

    expect(() => validateRequiredFields(data, requiredFields)).toThrow(ApiError);
    
    try {
      validateRequiredFields(data, requiredFields);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(400);
      expect((error as ApiError).message).toBe(ERROR_MESSAGES.REQUIRED_FIELDS_MISSING);
      expect((error as ApiError).details).toEqual({ missingFields: ['age'] });
    }
  });

  it('should throw ApiError when multiple required fields are missing', () => {
    const data = {
      name: 'test',
    };
    const requiredFields = ['name', 'email', 'age', 'phone'];

    try {
      validateRequiredFields(data, requiredFields);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).details).toEqual({
        missingFields: ['email', 'age', 'phone'],
      });
    }
  });

  it('should throw ApiError when field is null', () => {
    const data = {
      name: 'test',
      email: null,
    };
    const requiredFields = ['name', 'email'];

    expect(() => validateRequiredFields(data, requiredFields)).toThrow(ApiError);
  });

  it('should throw ApiError when field is undefined', () => {
    const data = {
      name: 'test',
    };
    const requiredFields = ['name', 'email'];

    expect(() => validateRequiredFields(data, requiredFields)).toThrow(ApiError);
  });

  it('should throw ApiError when field is empty string', () => {
    const data = {
      name: 'test',
      email: '',
    };
    const requiredFields = ['name', 'email'];

    expect(() => validateRequiredFields(data, requiredFields)).toThrow(ApiError);
  });

  it('should not throw when field is 0 (falsy but valid)', () => {
    const data = {
      name: 'test',
      count: 0,
    };
    const requiredFields = ['name', 'count'];

    expect(() => validateRequiredFields(data, requiredFields)).not.toThrow();
  });

  it('should not throw when field is false (falsy but valid)', () => {
    const data = {
      name: 'test',
      active: false,
    };
    const requiredFields = ['name', 'active'];

    expect(() => validateRequiredFields(data, requiredFields)).not.toThrow();
  });
});

describe('validateUrl', () => {
  it('should not throw for valid HTTP URL', () => {
    expect(() => validateUrl('http://example.com')).not.toThrow();
    expect(() => validateUrl('http://example.com/path')).not.toThrow();
    expect(() => validateUrl('http://example.com:8080/path?query=1')).not.toThrow();
  });

  it('should not throw for valid HTTPS URL', () => {
    expect(() => validateUrl('https://example.com')).not.toThrow();
    expect(() => validateUrl('https://example.com/path')).not.toThrow();
  });

  it('should throw ApiError for invalid URL', () => {
    expect(() => validateUrl('not-a-url')).toThrow(ApiError);
    expect(() => validateUrl('')).toThrow(ApiError);
    // Note: 'invalid://' is actually a valid URL format (unknown protocol), so we test with truly invalid formats
    expect(() => validateUrl('://missing-protocol')).toThrow(ApiError);
  });

  it('should throw ApiError with INVALID_URL message for invalid URL', () => {
    try {
      validateUrl('not-a-url');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toBe(ERROR_MESSAGES.INVALID_URL);
      expect((error as ApiError).statusCode).toBe(400);
    }
  });

  it('should accept HTTPS when httpsOnly is false', () => {
    expect(() => validateUrl('https://example.com', false)).not.toThrow();
  });

  it('should accept HTTP when httpsOnly is false', () => {
    expect(() => validateUrl('http://example.com', false)).not.toThrow();
  });

  it('should accept HTTPS when httpsOnly is true', () => {
    expect(() => validateUrl('https://example.com', true)).not.toThrow();
  });

  it('should throw ApiError for HTTP when httpsOnly is true', () => {
    expect(() => validateUrl('http://example.com', true)).toThrow(ApiError);
    
    try {
      validateUrl('http://example.com', true);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toBe(ERROR_MESSAGES.INVALID_HTTPS_URL);
      expect((error as ApiError).statusCode).toBe(400);
    }
  });

  it('should throw INVALID_HTTPS_URL for invalid URL when httpsOnly is true', () => {
    try {
      validateUrl('not-a-url', true);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toBe(ERROR_MESSAGES.INVALID_HTTPS_URL);
    }
  });
});

describe('successResponse', () => {
  it('should create a success response with default status 200', () => {
    const data = { id: 1, name: 'test' };
    const response = successResponse(data);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);

    const json = response.json() as Promise<any>;
    return json.then((result) => {
      expect(result).toEqual(data);
    });
  });

  it('should create a success response with custom status', () => {
    const data = { id: 1, name: 'test' };
    const response = successResponse(data, 201);

    expect(response.status).toBe(201);

    const json = response.json() as Promise<any>;
    return json.then((result) => {
      expect(result).toEqual(data);
    });
  });

  it('should handle null data', () => {
    const response = successResponse(null);
    expect(response.status).toBe(200);

    const json = response.json() as Promise<any>;
    return json.then((result) => {
      expect(result).toBeNull();
    });
  });

  it('should handle array data', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const response = successResponse(data);

    const json = response.json() as Promise<any>;
    return json.then((result) => {
      expect(result).toEqual(data);
    });
  });
});

describe('successMessageResponse', () => {
  it('should create a success message response with default status 200', () => {
    const response = successMessageResponse('Operation successful');

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);

    const json = response.json() as Promise<any>;
    return json.then((result) => {
      expect(result).toEqual({
        success: true,
        message: 'Operation successful',
      });
    });
  });

  it('should create a success message response with additional data', () => {
    const additionalData = { id: 1, count: 5 };
    const response = successMessageResponse('Operation successful', additionalData);

    const json = response.json() as Promise<any>;
    return json.then((result) => {
      expect(result).toEqual({
        success: true,
        message: 'Operation successful',
        id: 1,
        count: 5,
      });
    });
  });

  it('should create a success message response with custom status', () => {
    const response = successMessageResponse('Created', undefined, 201);

    expect(response.status).toBe(201);

    const json = response.json() as Promise<any>;
    return json.then((result) => {
      expect(result).toEqual({
        success: true,
        message: 'Created',
      });
    });
  });

  it('should merge additional data correctly', () => {
    const additionalData = { id: 1, nested: { value: 'test' } };
    const response = successMessageResponse('Success', additionalData);

    const json = response.json() as Promise<any>;
    return json.then((result) => {
      expect(result.success).toBe(true);
      expect(result.message).toBe('Success');
      expect(result.id).toBe(1);
      expect(result.nested).toEqual({ value: 'test' });
    });
  });
});
