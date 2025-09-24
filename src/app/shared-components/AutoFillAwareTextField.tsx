import { useCallback, useState, useEffect } from "react";
import { TextField, TextFieldProps } from "@mui/material";

// // Define the interface for props
// When creating a wrapper or customized version of an existing component (like TextField from Material-UI), we often extend the original component's props (TextFieldProps). TextField has a lot of props, such as label, helperText, variant, size, fullWidth, and more. By extending TextFieldProps, we automatically inherit all these props without having to re-declare them.
interface AutoFillAwareTextFieldProps extends Omit<TextFieldProps, "onChange"> {
  // => void specifies that this function does not return any value.
  onChange: (value: string | number) => void;
  value: string | number;
}

const AutoFillAwareTextField: React.FC<AutoFillAwareTextFieldProps> = ({
  onChange,
  value,
  ...rest
}) => {
  // Initialize the state to determine if the field has a value initially
  // !!value ensures that we are working with a boolean (true if value is present, false if not)
  const [fieldHasValue, setFieldHasValue] = useState<boolean>(!!value);

  // This function returns an event handler for onAnimationStart.
  // It detects when a CSS animation starts, which occurs during autofill.
  const makeAnimationStartHandler =
    (stateSetter: React.Dispatch<React.SetStateAction<boolean>>) =>
    (e: React.AnimationEvent<HTMLInputElement>) => {
      if (e.animationName === "mui-auto-fill") {
        stateSetter(true);
      }
      if (e.animationName === "mui-auto-fill-cancel") {
        stateSetter(false);
      }
    };

  // Memoized callback for handling changes in the input field
  // `useCallback` ensures that the function is only recreated if `onChange` changes
  const _onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange(newValue);
      setFieldHasValue(newValue !== "");
    },
    [onChange]
  );

  useEffect(() => {
    setFieldHasValue(value !== "");
  }, [value]);

  return (
    <TextField
      slotProps={{
        input: {
          onAnimationStart: makeAnimationStartHandler(
            setFieldHasValue
          ) as React.AnimationEventHandler<HTMLInputElement>,
        },
        // Additional properties for label shrinkage
        inputLabel: {
          shrink: fieldHasValue || !!value,
        },
      }}
      onChange={_onChange}
      value={value}
      {...rest}
    />
  );
};

export default AutoFillAwareTextField;
