import { useRef, useCallback } from 'react';

const SCROLL_AMOUNT = 220;

export const useTemplateScroll = () => {
    const templatesContainerRef = useRef<HTMLDivElement>(null);

    const scrollTemplates = useCallback((direction: 'left' | 'right') => {
        if (!templatesContainerRef.current) return;

        const currentScroll = templatesContainerRef.current.scrollLeft;
        const newScroll = direction === 'right'
            ? currentScroll + SCROLL_AMOUNT
            : currentScroll - SCROLL_AMOUNT;

        templatesContainerRef.current.scrollTo({
            left: newScroll,
            behavior: 'smooth'
        });
    }, []);

    const scrollToTemplate = useCallback((index: number) => {
        if (!templatesContainerRef.current) return;

        const container = templatesContainerRef.current;
        const templateElement = container.children[index] as HTMLElement;

        if (templateElement) {
            const scrollPosition = templateElement.offsetLeft - (container.offsetWidth - templateElement.offsetWidth) / 2;

            container.scrollTo({
                left: scrollPosition,
                behavior: 'smooth'
            });
        }
    }, []);

    return {
        templatesContainerRef,
        scrollTemplates,
        scrollToTemplate
    };
};