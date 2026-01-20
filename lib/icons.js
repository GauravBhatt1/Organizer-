import React from 'react';
import { html } from 'htm/react';

const createIcon = (path) => (props) => html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-6 h-6"
    ...${props}
  >
    ${path}
  </svg>
`;

export const DashboardIcon = createIcon(html`<path d="M13 3V11H21V3M13 13V21H21V13M3 3V11H11V3M3 13V21H11V13" />`);
export const MoviesIcon = createIcon(html`<path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />`);
export const TvIcon = createIcon(html`<path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />`);
export const UncategorizedIcon = createIcon(html`<path fillRule="evenodd" d="M14.78 14.78a.75.75 0 01-1.06 0L12 13.06l-1.72 1.72a.75.75 0 11-1.06-1.06L10.94 12l-1.72-1.72a.75.75 0 011.06-1.06L12 10.94l1.72-1.72a.75.75 0 111.06 1.06L13.06 12l1.72 1.72a.75.75 0 010 1.06z" clipRule="evenodd" />`);
export const SettingsIcon = createIcon(html`<path fillRule="evenodd" d="M11.07 2.55a.75.75 0 01.46.9l-.29 1.21a11.166 11.166 0 012.56 1.51l1.1-.53a.75.75 0 01.99.28l1.52 2.62a.75.75 0 01-.18.99l-.91.7a11.39 11.39 0 010 2.96l.91.7a.75.75 0 01.18.99l-1.52 2.62a.75.75 0 01-.99.28l-1.1-.53a11.166 11.166 0 01-2.56 1.51l.29 1.21a.75.75 0 01-.92.83h-3.04a.75.75 0 01-.92-.83l.29-1.21a11.166 11.166 0 01-2.56-1.51l-1.1.53a.75.75 0 01-.99-.28l-1.52-2.62a.75.75 0 01.18-.99l.91-.7a11.39 11.39 0 010-2.96l-.91-.7a.75.75 0 01-.18-.99l1.52-2.62a.75.75 0 01.99-.28l1.1.53c.8-.59 1.67-1.1 2.56-1.51l-.29-1.21a.75.75 0 01.46-.9h3.04zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />`);
export const PlayIcon = createIcon(html`<path d="M8 5v14l11-7z" />`);
export const CheckCircleIcon = createIcon(html`<path fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" clipRule="evenodd" />`);
export const ExclamationIcon = createIcon(html`<path fillRule="evenodd" d="M11 15h2v2h-2v-2zm0-8h2v6h-2V7z" clipRule="evenodd" />`);
export const InfoIcon = createIcon(html`<path fillRule="evenodd" d="M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z" clipRule="evenodd" />`);
export const CloseIcon = createIcon(html`<path fillRule="evenodd" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" clipRule="evenodd" />`);
export const EditIcon = createIcon(html`<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />`);
export const SearchIcon = createIcon(html`<path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />`);
export const FileIcon = createIcon(html`<path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />`);
export const PlusIcon = createIcon(html`<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />`);
export const TrashIcon = createIcon(html`<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />`);
export const LogoIcon = createIcon(html`<path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM9.034 8.243a.75.75 0 10-1.31-.786l-3.466 5.8a.75.75 0 00.655 1.133h6.932a.75.75 0 00.655-1.133l-3.466-5.8zm7.898 2.227a.75.75 0 00-1.31.786l1.733 2.9a.75.75 0 00.655 1.133h2.534a.75.75 0 000-1.5h-1.63l-1.982-3.32z" clipRule="evenodd" />`);
export const MenuIcon = createIcon(html`<path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />`);