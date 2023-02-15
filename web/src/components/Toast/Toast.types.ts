import type { IconProps } from 'react-toastify';

type ToastTypeType = 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING'

export enum ToastType {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  INFO = 'INFO',
  WARNING = 'WARNING',
}

export declare type ToastIcon = string | boolean | ((props: IconProps) => React.ReactNode) | React.ReactElement<IconProps> | string | number | React.ReactNode;

export interface ToastInfo {
  message: string;
  type: ToastTypeType;
  id?: string;
  autoclose?: boolean;
  icon?: ToastIcon;
}
