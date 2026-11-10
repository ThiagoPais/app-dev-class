import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/** Measured width of a container. Charts need it in pixels; 0 until the first layout. */
export function useLayoutWidth() {
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    setWidth((current) => (current === next ? current : next));
  };

  return { width, onLayout };
}
