import { createContext, MutableRefObject } from 'react';

export const WorkshopPageContext = createContext<MutableRefObject<boolean> | null>(null);
