'use client';

import { useState, useCallback } from 'react';
import { MapPin, Loader2, Navigation, X } from 'lucide-react';

interface LocationPickerProps {
  onLocationSelect: (location: string) => void;
  currentValue?: string;
}

interface LocationResult {
  address: string;
  lat: number;
  lng: number;
}

export default function LocationPicker({ onLocationSelect, currentValue }: LocationPickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationResult | null>(null);

  const getCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('이 브라우저에서는 위치 서비스를 지원하지 않습니다.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;

      // 역지오코딩 (좌표 → 주소) - 카카오 API 사용
      // 참고: 실제 서비스에서는 서버사이드에서 API 키를 사용해야 합니다
      const address = await reverseGeocode(latitude, longitude);

      const result: LocationResult = {
        address,
        lat: latitude,
        lng: longitude,
      };

      setLocation(result);
      onLocationSelect(address);
    } catch (err: any) {
      console.error('Location error:', err);
      if (err.code === 1) {
        setError('위치 권한이 거부되었습니다. 설정에서 위치 권한을 허용해주세요.');
      } else if (err.code === 2) {
        setError('위치를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.');
      } else if (err.code === 3) {
        setError('위치 확인 시간이 초과되었습니다.');
      } else {
        setError('위치를 가져오는데 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  }, [onLocationSelect]);

  const clearLocation = () => {
    setLocation(null);
    onLocationSelect('');
  };

  return (
    <div className="space-y-2">
      {/* 현재 위치 버튼 */}
      <button
        type="button"
        onClick={getCurrentLocation}
        disabled={loading}
        className="md:hidden flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors w-full justify-center disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>위치 확인 중...</span>
          </>
        ) : (
          <>
            <Navigation className="w-5 h-5" />
            <span>현재 위치로 지출 장소 입력</span>
          </>
        )}
      </button>

      {/* 에러 메시지 */}
      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1">
          <X className="w-4 h-4" />
          {error}
        </p>
      )}

      {/* 선택된 위치 표시 */}
      {location && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
          <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 break-words">{location.address}</p>
            <p className="text-xs text-gray-500 mt-1">
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </p>
          </div>
          <button
            type="button"
            onClick={clearLocation}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// 역지오코딩 함수 (좌표 → 주소)
// 카카오 API 또는 네이버 API를 사용할 수 있습니다
// 여기서는 간단한 Nominatim (OpenStreetMap) API를 사용합니다 (무료, 제한적)
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    // Nominatim API 사용 (무료, 상업용은 별도 협의 필요)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'ko',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding failed');
    }

    const data = await response.json();

    // 한국 주소 형식으로 변환
    if (data.address) {
      const parts: string[] = [];

      // 시/도
      if (data.address.city || data.address.state) {
        parts.push(data.address.city || data.address.state);
      }

      // 구/군
      if (data.address.suburb || data.address.county || data.address.district) {
        parts.push(data.address.suburb || data.address.county || data.address.district);
      }

      // 동/읍/면
      if (data.address.neighbourhood || data.address.village || data.address.town) {
        parts.push(data.address.neighbourhood || data.address.village || data.address.town);
      }

      // 도로명
      if (data.address.road) {
        parts.push(data.address.road);
      }

      // 건물번호
      if (data.address.house_number) {
        parts.push(data.address.house_number);
      }

      if (parts.length > 0) {
        return parts.join(' ');
      }
    }

    // 기본 표시 이름 사용
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    // 실패 시 좌표를 반환
    return `위치: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

// 위치 지원 여부 확인 훅
export function useLocationSupport() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}
