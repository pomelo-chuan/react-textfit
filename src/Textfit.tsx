import React from 'react';
import throttle from 'lodash/throttle';
import uniqueId from 'lodash/uniqueId';
import isEqual from 'lodash/isEqual';
import series from './utils/series';
import whilst from './utils/whilst';
import { innerWidth, innerHeight } from './utils/innerSize';

/**
 * Props for the TextFit component
 */
interface TextFitProps {
    /** 
     * The content to be rendered inside the TextFit component.
     * Can be either React nodes or a render function that receives the text as an argument.
     */
    children?: React.ReactNode | ((text: string) => React.ReactNode);

    /**
     * Optional text to be used when children is a render function.
     * This text will be passed to the render function once the component is ready.
     */
    text?: string;

    /**
     * Minimum font size in pixels.
     * @default 1
     */
    min?: number;

    /**
     * Maximum font size in pixels.
     * @default 100
     */
    max?: number;

    /**
     * Algorithm mode to fit the text.
     * - 'single': Use for headlines (single line)
     * - 'multi': Use for paragraphs (multiple lines)
     * @default 'multi'
     */
    mode?: 'single' | 'multi';

    /**
     * When mode is 'single' and this is true, the element's height will be ignored.
     * Set to false to respect both width and height in single line mode.
     * @default true
     */
    forceSingleModeWidth?: boolean;

    /**
     * Window resize throttle in milliseconds.
     * Controls how often the component recalculates on window resize.
     * @default 50
     */
    throttle?: number;

    /**
     * Whether to automatically resize when window size changes.
     * @default true
     */
    autoResize?: boolean;

    /**
     * Callback function that will be called when text fitting is complete.
     * Receives the final calculated font size as an argument.
     * @param fontSize The final calculated font size in pixels
     * @default noop
     */
    onReady?: (fontSize: number) => void;

    /**
     * Additional style properties to apply to the container element.
     */
    style?: React.CSSProperties;

    /**
     * Any additional props will be passed to the container div element.
     */
    [key: string]: any;
}

interface TextFitState {
    fontSize: number | undefined;
    ready: boolean;
}

function assertElementFitsWidth(el: HTMLElement, width: number): boolean {
    // -1: temporary bugfix, will be refactored soon
    return el.scrollWidth - 1 <= width;
}

function assertElementFitsHeight(el: HTMLElement, height: number): boolean {
    // -1: temporary bugfix, will be refactored soon
    return el.scrollHeight - 1 <= height;
}

function noop(): void {}

export default class TextFit extends React.Component<TextFitProps, TextFitState> {
    static defaultProps = {
        min: 1,
        max: 100,
        mode: 'multi' as const,
        forceSingleModeWidth: true,
        throttle: 50,
        autoResize: true,
        onReady: noop
    };

    private _parent: HTMLDivElement | null = null;
    private _child: HTMLDivElement | null = null;
    private pid: string = '';
    private readonly handleWindowResize: () => void;

    constructor(props: TextFitProps) {
        super(props);
        if ('perfectFit' in props) {
            console.warn('TextFit property perfectFit has been removed.');
        }

        this.state = {
            fontSize: undefined,
            ready: false
        };

        this.handleWindowResize = throttle(this.process.bind(this), props.throttle);
    }

    componentDidMount(): void {
        const { autoResize } = this.props;
        if (autoResize) {
            window.addEventListener('resize', this.handleWindowResize);
        }
        this.process();
    }

    componentDidUpdate(prevProps: TextFitProps): void {
        const { ready } = this.state;
        if (!ready) return;
        if (isEqual(this.props, prevProps)) return;
        this.process();
    }

    componentWillUnmount(): void {
        const { autoResize } = this.props;
        if (autoResize) {
            window.removeEventListener('resize', this.handleWindowResize);
        }
        // Setting a new pid will cancel all running processes
        this.pid = uniqueId();
    }

    process = (): void => {
        const { min, max, mode, forceSingleModeWidth, onReady } = this.props;
        
        if (!this._parent || !this._child) return;
        
        const el = this._parent;
        const wrapper = this._child;

        const originalWidth = innerWidth(el);
        const originalHeight = innerHeight(el);

        if (originalHeight <= 0 || isNaN(originalHeight)) {
            console.warn('Can not process element without height. Make sure the element is displayed and has a static height.');
            return;
        }

        if (originalWidth <= 0 || isNaN(originalWidth)) {
            console.warn('Can not process element without width. Make sure the element is displayed and has a static width.');
            return;
        }

        const pid = uniqueId();
        this.pid = pid;

        const shouldCancelProcess = (): boolean => pid !== this.pid;

        const testPrimary = mode === 'multi'
            ? () => assertElementFitsHeight(wrapper, originalHeight)
            : () => assertElementFitsWidth(wrapper, originalWidth);

        const testSecondary = mode === 'multi'
            ? () => assertElementFitsWidth(wrapper, originalWidth)
            : () => assertElementFitsHeight(wrapper, originalHeight);

        let mid: number;
        let low = min || 1;
        let high = max || 100;

        this.setState({ ready: false });

        series([
            // Step 1:
            // Binary search to fit the element's height (multi line) / width (single line)
            stepCallback => whilst(
                () => low <= high,
                whilstCallback => {
                    if (shouldCancelProcess()) return whilstCallback(true);
                    mid = parseInt(((low + high) / 2).toString(), 10);
                    this.setState({ fontSize: mid }, () => {
                        if (shouldCancelProcess()) return whilstCallback(true);
                        if (testPrimary()) low = mid + 1;
                        else high = mid - 1;
                        return whilstCallback();
                    });
                },
                stepCallback
            ),
            // Step 2:
            // Binary search to fit the element's width (multi line) / height (single line)
            // If mode is single and forceSingleModeWidth is true, skip this step
            stepCallback => {
                if (mode === 'single' && forceSingleModeWidth) return stepCallback(null);
                if (testSecondary()) return stepCallback(null);
                low = min || 1;
                high = mid!;
                return whilst(
                    () => low < high,
                    whilstCallback => {
                        if (shouldCancelProcess()) return whilstCallback(true);
                        mid = parseInt(((low + high) / 2).toString(), 10);
                        this.setState({ fontSize: mid }, () => {
                            if (pid !== this.pid) return whilstCallback(true);
                            if (testSecondary()) low = mid + 1;
                            else high = mid - 1;
                            return whilstCallback();
                        });
                    },
                    stepCallback
                );
            },
            // Step 3
            // Limits
            stepCallback => {
                // We break the previous loop without updating mid for the final time,
                // so we do it here:
                mid = Math.min(low, high);

                // Ensure we hit the user-supplied limits
                mid = Math.max(mid, min || 1);
                mid = Math.min(mid, max || 100);

                // Sanity check:
                mid = Math.max(mid, 0);

                if (shouldCancelProcess()) return stepCallback(true);
                this.setState({ fontSize: mid }, () => stepCallback(null));
            }
        ], (err?: boolean) => {
            // err will be true, if another process was triggered
            if (err || shouldCancelProcess()) return;
            this.setState({ ready: true }, () => onReady?.(mid!));
        });
    };

    render(): React.ReactNode {
        const {
            children,
            text,
            style,
            min,
            max,
            mode,
            forceSingleModeWidth,
            throttle: _throttle,
            autoResize,
            onReady,
            ...props
        } = this.props;
        
        const { fontSize, ready } = this.state;
        
        const finalStyle: React.CSSProperties = {
            ...style,
            fontSize: fontSize
        };

        const wrapperStyle: React.CSSProperties = {
            display: ready ? 'block' : 'inline-block'
        };
        
        if (mode === 'single') {
            wrapperStyle.whiteSpace = 'nowrap';
        }

        return (
            <div ref={c => this._parent = c} style={finalStyle} {...props}>
                <div ref={c => this._child = c} style={wrapperStyle}>
                    {text && typeof children === 'function'
                        ? ready
                            ? children(text)
                            : text
                        : children
                    }
                </div>
            </div>
        );
    }
} 