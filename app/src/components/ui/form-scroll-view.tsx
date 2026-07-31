import { forwardRef } from 'react';
import type { ScrollViewProps } from 'react-native';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';

export type FormScrollViewProps = ScrollViewProps & {
  /** Gap left between the keyboard and the focused field. */
  bottomOffset?: number;
  /** Extra room when something sticky (a footer) sits below the scroll view. */
  extraKeyboardSpace?: number;
};

/**
 * Scroll container for any screen that has text inputs (DESIGN.md §8.8).
 *
 * Wraps `KeyboardAwareScrollView`, which scrolls the focused field up above the
 * keyboard in step with the keyboard animation on both platforms. A plain
 * `ScrollView` + `KeyboardAvoidingView` left fields low on the screen sitting
 * under the keyboard — on Android especially, where edge-to-edge means the
 * window no longer resizes when the keyboard opens.
 */
export const FormScrollView = forwardRef<KeyboardAwareScrollViewRef, FormScrollViewProps>(
  function FormScrollView({ bottomOffset = 24, ...rest }, ref) {
    return (
      <KeyboardAwareScrollView
        ref={ref}
        bottomOffset={bottomOffset}
        // Taps on buttons/chips land on the first tap instead of only
        // dismissing the keyboard.
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...rest}
      />
    );
  },
);
