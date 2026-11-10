import { Platform } from 'react-native';

/**
 * Content width cap. Wide browser windows get a phone-sized column; on devices screens
 * fill the display, since a cap leaves bars at the edges on phones wider than 430dp.
 */
export const SCREEN_MAX_WIDTH = Platform.OS === 'web' ? 430 : undefined;

/**
 * KeyboardAvoidingView behavior for every platform. Android apps are edge-to-edge, so the
 * window no longer resizes for the keyboard and the view has to add the padding itself.
 */
export const KEYBOARD_AVOIDING_BEHAVIOR = 'padding' as const;
