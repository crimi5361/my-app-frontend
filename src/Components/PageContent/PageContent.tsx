import { ReactNode } from "react";

 interface PageContentsProps  {
  isSidemenuOpen: boolean;
  children?: ReactNode
 }


 const PageContent: React.FC<PageContentsProps> = ({ isSidemenuOpen, children }) => {
  return (
    <div
      className={`p-4 pt-20 bg-[var(--paper)] dark:bg-gray-900 min-h-screen transition-all duration-300
      ${isSidemenuOpen ? "ml-64 w-[calc(100%-16rem)]" : "ml-20 w-[calc(100%-5rem)]"}`}
    >
      {children}
    </div>
  );
};

export default PageContent;

