import { useCallback, useState, useEffect } from "react";
import { TextField, TextFieldProps } from "@mui/material";

interface AutoFillAwareTextFieldProps extends Omit<TextFieldProps, "onChange"> {
  onChange: (value: string | number) => void;
  value: string | number;
}

const AutoFillAwareTextField: React.FC<AutoFillAwareTextFieldProps> = ({
  onChange,
  value,
  ...rest
}) => {
  const [fieldHasValue, setFieldHasValue] = useState<boolean>(!!value);

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
