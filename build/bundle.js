
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.31.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.31.2 */

    const { Object: Object_1, console: console_1 } = globals;
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let div45;
    	let div4;
    	let div3;
    	let div2;
    	let div1;
    	let h50;
    	let t1;
    	let div0;
    	let input0;
    	let t2;
    	let label0;
    	let t4;
    	let input1;
    	let t5;
    	let label1;
    	let t7;
    	let input2;
    	let t8;
    	let label2;
    	let t10;
    	let input3;
    	let t11;
    	let label3;
    	let t13;
    	let div9;
    	let div8;
    	let div7;
    	let div6;
    	let h51;
    	let t15;
    	let div5;
    	let input4;
    	let t16;
    	let label4;
    	let t18;
    	let input5;
    	let t19;
    	let label5;
    	let t21;
    	let div14;
    	let div13;
    	let div12;
    	let div11;
    	let h52;
    	let t22;
    	let span;
    	let t24;
    	let div10;
    	let input6;
    	let t25;
    	let label6;
    	let t27;
    	let input7;
    	let t28;
    	let label7;
    	let t30;
    	let div19;
    	let div18;
    	let div17;
    	let div16;
    	let h53;
    	let t32;
    	let div15;
    	let input8;
    	let t33;
    	let label8;
    	let t35;
    	let input9;
    	let t36;
    	let label9;
    	let t38;
    	let div24;
    	let div23;
    	let div22;
    	let div21;
    	let h54;
    	let t40;
    	let div20;
    	let input10;
    	let t41;
    	let label10;
    	let t44;
    	let input11;
    	let t45;
    	let label11;
    	let t47;
    	let input12;
    	let t48;
    	let label12;
    	let t50;
    	let input13;
    	let t51;
    	let label13;
    	let t53;
    	let input99;
    	let t98;
    	let label99;
    	let t99;
    	let div29;
    	let div28;
    	let div27;
    	let div26;
    	let h55;
    	let t55;
    	let div25;
    	let input14;
    	let t56;
    	let label14;
    	let t58;
    	let input15;
    	let t59;
    	let label15;
    	let t61;
    	let input16;
    	let t62;
    	let label16;
    	let t64;
    	let div34;
    	let div33;
    	let div32;
    	let div31;
    	let h56;
    	let t66;
    	let div30;
    	let input17;
    	let t67;
    	let label17;
    	let t69;
    	let input18;
    	let t70;
    	let label18;
    	let t72;
    	let input19;
    	let t73;
    	let label19;
    	let t75;
    	let div44;
    	let div37;
    	let div36;
    	let div35;
    	let h57;
    	let t77;
    	let h30;
    	let t78;
    	let t79;
    	let t80;
    	let div40;
    	let div39;
    	let div38;
    	let h58;
    	let t82;
    	let h31;
    	let t83;
    	let t84;
    	let div43;
    	let div42;
    	let div41;
    	let h59;
    	let t86;
    	let h32;
    	let t87;
    	let t88;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			div45 = element("div");
    			div4 = element("div");
    			div3 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			h50 = element("h5");
    			h50.textContent = "Mechanical ventilation anytime during hospital stay";
    			t1 = space();
    			div0 = element("div");
    			input0 = element("input");
    			t2 = space();
    			label0 = element("label");
    			label0.textContent = `${"No"}`;
    			t4 = space();
    			input1 = element("input");
    			t5 = space();
    			label1 = element("label");
    			label1.textContent = "Yes";
    			t7 = space();
    			input2 = element("input");
    			t8 = space();
    			label2 = element("label");
    			label2.textContent = "70-79";
    			t10 = space();
    			input3 = element("input");
    			t11 = space();
    			label3 = element("label");
    			label3.textContent = "≥80";
    			t13 = space();
    			div9 = element("div");
    			div8 = element("div");
    			div7 = element("div");
    			div6 = element("div");
    			h51 = element("h5");
    			h51.textContent = "Blood urea nitrogen (mg/dL)";
    			t15 = space();
    			div5 = element("div");
    			input4 = element("input");
    			t16 = space();
    			label4 = element("label");
    			label4.textContent = `${"<42"}`;
    			t18 = space();
    			input5 = element("input");
    			t19 = space();
    			label5 = element("label");
    			label5.textContent = "≥42";
    			t21 = space();
    			div14 = element("div");
    			div13 = element("div");
    			div12 = element("div");
    			div11 = element("div");
    			h52 = element("h5");
    			t22 = text("Ventilação mecânica em qualquer momento da internação ");
    			span = element("span");
    			span.textContent = "(Exceto nos casos que a diálise precede a ventilação mecânica)";
    			t24 = space();
    			div10 = element("div");
    			input6 = element("input");
    			t25 = space();
    			label6 = element("label");
    			label6.textContent = `${"Não"}`;
    			t27 = space();
    			input7 = element("input");
    			t28 = space();
    			label7 = element("label");
    			label7.textContent = "Sim";
    			t30 = space();
    			div19 = element("div");
    			div18 = element("div");
    			div17 = element("div");
    			div16 = element("div");
    			h53 = element("h5");
    			h53.textContent = "Sexo masculino";
    			t32 = space();
    			div15 = element("div");
    			input8 = element("input");
    			t33 = space();
    			label8 = element("label");
    			label8.textContent = `${"Não"}`;
    			t35 = space();
    			input9 = element("input");
    			t36 = space();
    			label9 = element("label");
    			label9.textContent = "Sim";
    			t38 = space();
    			div24 = element("div");
    			div23 = element("div");
    			div22 = element("div");
    			div21 = element("div");
    			h54 = element("h5");
    			h54.textContent = "Creatinina (mg/dL) à admissão";
    			t40 = space();
    			div20 = element("div");
    			input10 = element("input");
    			t41 = space();
    			label10 = element("label");
    			label10.textContent = `${"<"}1.2`;
    			t44 = space();
    			input11 = element("input");
    			t45 = space();
    			label11 = element("label");
    			label11.textContent = "1.2 - 2.0";
    			t47 = space();
    			input12 = element("input");
    			t48 = space();
    			label12 = element("label");
    			label12.textContent = "2.0 - 3.5";
    			t50 = space();
    			input13 = element("input");
    			t51 = space();
    			label13 = element("label");
    			label13.textContent = `${"3.5 - 5.0"}`;
    			t53 = space();
          input99 = element("input");
          t98 = space();
    			label99 = element("label");
    			label99.textContent = "≥5.0";
    			t99 = space();
    			div29 = element("div");
    			div28 = element("div");
    			div27 = element("div");
    			div26 = element("div");
    			h55 = element("h5");
    			h55.textContent = "Diabetes mellitus";
    			t55 = space();
    			div25 = element("div");
    			input14 = element("input");
    			t56 = space();
    			label14 = element("label");
    			label14.textContent = `${"No"}`;
    			t58 = space();
    			input15 = element("input");
    			t59 = space();
    			label15 = element("label");
    			label15.textContent = "No";
    			t61 = space();
    			input16 = element("input");
    			t62 = space();
    			label16 = element("label");
    			label16.textContent = `${"Yes"}`;
    			t64 = space();
    			div34 = element("div");
    			div33 = element("div");
    			div32 = element("div");
    			div31 = element("div");
    			h56 = element("h5");
    			h56.textContent = "Heart rate (bpm)";
    			t66 = space();
    			div30 = element("div");
    			input17 = element("input");
    			t67 = space();
    			label17 = element("label");
    			label17.textContent = `${"≤90"}`;
    			t69 = space();
    			input18 = element("input");
    			t70 = space();
    			label18 = element("label");
    			label18.textContent = "91-130";
    			t72 = space();
    			input19 = element("input");
    			t73 = space();
    			label19 = element("label");
    			label19.textContent = `${"≥131"}`;
    			t75 = space();
    			div44 = element("div");
    			div37 = element("div");
    			div36 = element("div");
    			div35 = element("div");
    			h57 = element("h5");
    			h57.textContent = "Final score";
    			t77 = space();
    			h30 = element("h3");
    			t78 = text(/*score*/ ctx[0]);
    			t79 = text("/23");
    			t80 = space();
    			div40 = element("div");
    			div39 = element("div");
    			div38 = element("div");
    			h58 = element("h5");
    			h58.textContent = "Risk group";
    			t82 = space();
    			h31 = element("h3");
    			t83 = text(/*riskGroup*/ ctx[1]);
    			t84 = space();
    			div43 = element("div");
    			div42 = element("div");
    			div41 = element("div");
    			h59 = element("h5");
    			h59.textContent = "Kidney replacement therapy requirement risk (%)";
    			t86 = space();
    			h32 = element("h3");
    			t87 = text(/*probability*/ ctx[2]);
    			t88 = text("%");
    			attr_dev(input0, "type", "radio");
    			attr_dev(input0, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input0, "name", "btnradio");
    			attr_dev(input0, "id", "btnradio1");
    			attr_dev(input0, "autocomplete", "off");
    			input0.checked = true;
    			add_location(input0, file, 153, 6, 2085);
    			attr_dev(label0, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label0, "for", "btnradio1");
    			add_location(label0, file, 154, 6, 2235);
    			attr_dev(input1, "type", "radio");
    			attr_dev(input1, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input1, "name", "btnradio");
    			attr_dev(input1, "id", "btnradio2");
    			attr_dev(input1, "autocomplete", "off");
    			add_location(input1, file, 156, 6, 2314);
    			attr_dev(label1, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label1, "for", "btnradio2");
    			add_location(label1, file, 157, 6, 2456);
    			attr_dev(input2, "type", "radio");
    			attr_dev(input2, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input2, "name", "btnradio");
    			attr_dev(input2, "id", "btnradio3");
    			attr_dev(input2, "autocomplete", "off");
    			add_location(input2, file, 159, 6, 2534);
    			attr_dev(label2, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label2, "for", "btnradio3");
    			add_location(label2, file, 160, 6, 2676);
    			attr_dev(input3, "type", "radio");
    			attr_dev(input3, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input3, "name", "btnradio");
    			attr_dev(input3, "id", "btnradio4");
    			attr_dev(input3, "autocomplete", "off");
    			add_location(input3, file, 162, 6, 2754);
    			attr_dev(label3, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label3, "for", "btnradio4");
    			add_location(label3, file, 163, 6, 2896);
    			attr_dev(div0, "class", "btn-group");
    			attr_dev(div0, "role", "group");
    			attr_dev(div0, "aria-label", "Basic radio toggle button group");
    			add_location(div0, file, 152, 5, 1997);
    			attr_dev(div1, "class", "card-body");
    			add_location(div1, file, 150, 4, 1923);
    			attr_dev(div2, "class", "card svelte-1i9ap28");
    			add_location(div2, file, 149, 4, 1899);
    			attr_dev(div3, "class", "col-md-12 col-sm-12 mb-3");
    			add_location(div3, file, 148, 3, 1856);
    			attr_dev(div4, "class", "row align-items-center justify-content-center mt-3");
    			add_location(div4, file, 147, 2, 1788);
    			attr_dev(h51, "class", "card-title");
    			add_location(h51, file, 174, 5, 3180);
    			attr_dev(input4, "type", "radio");
    			attr_dev(input4, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input4, "name", "btnradio2");
    			attr_dev(input4, "id", "btnradio5");
    			attr_dev(input4, "autocomplete", "off");
    			input4.checked = true;
    			add_location(input4, file, 176, 6, 3329);
    			attr_dev(label4, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label4, "for", "btnradio5");
    			add_location(label4, file, 177, 6, 3482);
    			attr_dev(input5, "type", "radio");
    			attr_dev(input5, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input5, "name", "btnradio2");
    			attr_dev(input5, "id", "btnradio6");
    			attr_dev(input5, "autocomplete", "off");
    			add_location(input5, file, 179, 6, 3561);
    			attr_dev(label5, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label5, "for", "btnradio6");
    			add_location(label5, file, 180, 6, 3706);
    			attr_dev(div5, "class", "btn-group");
    			attr_dev(div5, "role", "group");
    			attr_dev(div5, "aria-label", "Basic radio toggle button group");
    			add_location(div5, file, 175, 5, 3241);
    			attr_dev(div6, "class", "card-body");
    			add_location(div6, file, 173, 4, 3151);
    			attr_dev(div7, "class", "card svelte-1i9ap28");
    			add_location(div7, file, 172, 4, 3127);
    			attr_dev(div8, "class", "col-md-12 col-sm-12 mb-3");
    			add_location(div8, file, 171, 3, 3084);
    			attr_dev(div9, "class", "row align-items-center justify-content-center");
    			add_location(div9, file, 170, 2, 3021);
    			set_style(span, "font-size", "14px");
    			set_style(span, "color", "#4e4e4e");
    			add_location(span, file, 191, 43, 4028);
    			attr_dev(h52, "class", "card-title");
    			add_location(h52, file, 191, 5, 3990);
    			attr_dev(input6, "type", "radio");
    			attr_dev(input6, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input6, "name", "btnradio3");
    			attr_dev(input6, "id", "btnradio7");
    			attr_dev(input6, "autocomplete", "off");
    			input6.checked = true;
    			add_location(input6, file, 193, 6, 4334);
    			attr_dev(label6, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label6, "for", "btnradio7");
    			add_location(label6, file, 194, 6, 4495);
    			attr_dev(input7, "type", "radio");
    			attr_dev(input7, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input7, "name", "btnradio3");
    			attr_dev(input7, "id", "btnradio8");
    			attr_dev(input7, "autocomplete", "off");
    			add_location(input7, file, 196, 6, 4573);
    			attr_dev(label7, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label7, "for", "btnradio8");
    			add_location(label7, file, 197, 6, 4726);
    			attr_dev(div10, "class", "btn-group");
    			attr_dev(div10, "role", "group");
    			attr_dev(div10, "aria-label", "Basic radio toggle button group");
    			add_location(div10, file, 192, 5, 4246);
    			attr_dev(div11, "class", "card-body");
    			add_location(div11, file, 190, 4, 3961);
    			attr_dev(div12, "class", "card svelte-1i9ap28");
    			add_location(div12, file, 189, 4, 3937);
    			attr_dev(div13, "class", "col-md-12 col-sm-12 mb-3");
    			add_location(div13, file, 188, 3, 3894);
    			attr_dev(div14, "class", "row align-items-center justify-content-center");
    			add_location(div14, file, 187, 2, 3831);
    			attr_dev(h53, "class", "card-title");
    			add_location(h53, file, 208, 5, 5009);
    			attr_dev(input8, "type", "radio");
    			attr_dev(input8, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input8, "name", "btnradio4");
    			attr_dev(input8, "id", "btnradio9");
    			attr_dev(input8, "autocomplete", "off");
    			input8.checked = true;
    			add_location(input8, file, 210, 6, 5156);
    			attr_dev(label8, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label8, "for", "btnradio9");
    			add_location(label8, file, 211, 6, 5312);
    			attr_dev(input9, "type", "radio");
    			attr_dev(input9, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input9, "name", "btnradio4");
    			attr_dev(input9, "id", "btnradio10");
    			attr_dev(input9, "autocomplete", "off");
    			add_location(input9, file, 213, 6, 5392);
    			attr_dev(label9, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label9, "for", "btnradio10");
    			add_location(label9, file, 214, 6, 5541);
    			attr_dev(div15, "class", "btn-group");
    			attr_dev(div15, "role", "group");
    			attr_dev(div15, "aria-label", "Basic radio toggle button group");
    			add_location(div15, file, 209, 5, 5068);
    			attr_dev(div16, "class", "card-body");
    			add_location(div16, file, 207, 4, 4980);
    			attr_dev(div17, "class", "card svelte-1i9ap28");
    			add_location(div17, file, 206, 4, 4956);
    			attr_dev(div18, "class", "col-md-12 col-sm-12 mb-3");
    			add_location(div18, file, 205, 3, 4913);
    			attr_dev(div19, "class", "row align-items-center justify-content-center");
    			add_location(div19, file, 204, 2, 4850);
    			attr_dev(h54, "class", "card-title");
    			add_location(h54, file, 225, 5, 5827);
    			attr_dev(input10, "type", "radio");
    			attr_dev(input10, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input10, "name", "btnradio5");
    			attr_dev(input10, "id", "btnradio14");
    			attr_dev(input10, "autocomplete", "off");
    			add_location(input10, file, 227, 6, 5962);
    			attr_dev(label10, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label10, "for", "btnradio14");
          input10.checked = true;
    			add_location(label10, file, 228, 6, 6110);
    			attr_dev(input11, "type", "radio");
    			attr_dev(input11, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input11, "name", "btnradio5");
    			attr_dev(input11, "id", "btnradio13");
    			attr_dev(input11, "autocomplete", "off");
    			add_location(input11, file, 230, 6, 6193);
    			attr_dev(label11, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label11, "for", "btnradio13");
    			add_location(label11, file, 231, 6, 6341);
    			attr_dev(input12, "type", "radio");
    			attr_dev(input12, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input12, "name", "btnradio5");
    			attr_dev(input12, "id", "btnradio12");
    			attr_dev(input12, "autocomplete", "off");
    			add_location(input12, file, 232, 6, 6423);
    			attr_dev(label12, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label12, "for", "btnradio12");
    			add_location(label12, file, 233, 6, 6571);
    			attr_dev(input13, "type", "radio");
    			attr_dev(input13, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input13, "name", "btnradio5");
    			attr_dev(input13, "id", "btnradio11");
    			attr_dev(input13, "autocomplete", "off");
    			input13.checked = false;
    			add_location(input13, file, 236, 6, 6669);
    			attr_dev(label13, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label13, "for", "btnradio11");
    			add_location(label13, file, 237, 6, 6825);
    			attr_dev(input99, "type", "radio");
    			attr_dev(input99, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input99, "name", "btnradio5");
    			attr_dev(input99, "id", "btnradio99");
    			attr_dev(input99, "autocomplete", "off");
    			input99.checked = false;
    			add_location(input99, file, 240, 6, 8000);
    			attr_dev(label99, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label99, "for", "btnradio99");
    			add_location(label99, file, 241, 6, 8030);
    			attr_dev(div20, "class", "btn-group");
    			attr_dev(div20, "role", "group");
    			attr_dev(div20, "aria-label", "Basic radio toggle button group");
    			add_location(div20, file, 226, 5, 5874);
    			attr_dev(div21, "class", "card-body");
    			add_location(div21, file, 224, 4, 5798);
    			attr_dev(div22, "class", "card svelte-1i9ap28");
    			add_location(div22, file, 223, 4, 5774);
    			attr_dev(div23, "class", "col-md-12 col-sm-12 mb-3");
    			add_location(div23, file, 222, 3, 5731);
    			attr_dev(div24, "class", "row align-items-center justify-content-center");
    			add_location(div24, file, 221, 2, 5668);
    			attr_dev(h55, "class", "card-title");
    			add_location(h55, file, 249, 5, 7115);
    			attr_dev(input14, "type", "radio");
    			attr_dev(input14, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input14, "name", "btnradio6");
    			attr_dev(input14, "id", "btnradio17");
    			attr_dev(input14, "autocomplete", "off");
    			add_location(input14, file, 251, 6, 7262);
    			attr_dev(label14, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label14, "for", "btnradio17");
    			add_location(label14, file, 252, 6, 7409);
    			attr_dev(input15, "type", "radio");
    			attr_dev(input15, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input15, "name", "btnradio6");
    			attr_dev(input15, "id", "btnradio16");
    			attr_dev(input15, "autocomplete", "off");
    			add_location(input15, file, 254, 6, 7490);
    			attr_dev(label15, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label15, "for", "btnradio16");
    			add_location(label15, file, 255, 6, 7637);
          input15.checked = true;
    			attr_dev(input16, "type", "radio");
    			attr_dev(input16, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input16, "name", "btnradio6");
    			attr_dev(input16, "id", "btnradio15");
    			attr_dev(input16, "autocomplete", "off");
    			input16.checked = false;
    			add_location(input16, file, 257, 6, 7724);
    			attr_dev(label16, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label16, "for", "btnradio15");
    			add_location(label16, file, 258, 6, 7879);
    			attr_dev(div25, "class", "btn-group");
    			attr_dev(div25, "role", "group");
    			attr_dev(div25, "aria-label", "Basic radio toggle button group");
    			add_location(div25, file, 250, 5, 7174);
    			attr_dev(div26, "class", "card-body");
    			add_location(div26, file, 248, 4, 7086);
    			attr_dev(div27, "class", "card svelte-1i9ap28");
    			add_location(div27, file, 247, 4, 7062);
    			attr_dev(div28, "class", "col-md-12 col-sm-12 mb-3");
    			add_location(div28, file, 246, 3, 7019);
    			attr_dev(div29, "class", "row align-items-center justify-content-center");
    			add_location(div29, file, 245, 2, 6956);
    			attr_dev(h56, "class", "card-title");
    			add_location(h56, file, 271, 5, 8180);
    			attr_dev(input17, "type", "radio");
    			attr_dev(input17, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input17, "name", "btnradio7");
    			attr_dev(input17, "id", "btnradio18");
    			attr_dev(input17, "autocomplete", "off");
    			input17.checked = true;
    			add_location(input17, file, 273, 6, 8319);
    			attr_dev(label17, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label17, "for", "btnradio18");
    			add_location(label17, file, 274, 6, 8473);
    			attr_dev(input18, "type", "radio");
    			attr_dev(input18, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input18, "name", "btnradio7");
    			attr_dev(input18, "id", "btnradio19");
    			attr_dev(input18, "autocomplete", "off");
    			add_location(input18, file, 276, 6, 8554);
    			attr_dev(label18, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label18, "for", "btnradio19");
    			add_location(label18, file, 277, 6, 8700);
    			attr_dev(input19, "type", "radio");
    			attr_dev(input19, "class", "btn-check svelte-1i9ap28");
    			attr_dev(input19, "name", "btnradio7");
    			attr_dev(input19, "id", "btnradio20");
    			attr_dev(input19, "autocomplete", "off");
    			add_location(input19, file, 279, 6, 8786);
    			attr_dev(label19, "class", "btn btn-outline-primary svelte-1i9ap28");
    			attr_dev(label19, "for", "btnradio20");
    			add_location(label19, file, 280, 6, 8932);
    			attr_dev(div30, "class", "btn-group");
    			attr_dev(div30, "role", "group");
    			attr_dev(div30, "aria-label", "Basic radio toggle button group");
    			add_location(div30, file, 272, 5, 8231);
    			attr_dev(div31, "class", "card-body");
    			add_location(div31, file, 270, 4, 8151);
    			attr_dev(div32, "class", "card svelte-1i9ap28");
    			add_location(div32, file, 269, 4, 8127);
    			attr_dev(div33, "class", "col-md-12 col-sm-12 mb-3");
    			add_location(div33, file, 268, 3, 8084);
    			attr_dev(div34, "class", "row align-items-center justify-content-center mb-4");
    			add_location(div34, file, 267, 2, 8016);
    			attr_dev(h57, "class", "card-title fw-light");
    			add_location(h57, file, 294, 6, 9239);
    			attr_dev(h30, "class", "card-title fw-bold");
    			add_location(h30, file, 295, 6, 9294);
    			attr_dev(div35, "class", "card-body");
    			add_location(div35, file, 293, 5, 9209);
    			attr_dev(div36, "class", "card svelte-1i9ap28");
    			add_location(div36, file, 292, 4, 9184);
    			attr_dev(div37, "class", "col-md-3 col-sm-12 mb-3");
    			add_location(div37, file, 291, 3, 9142);
    			attr_dev(h58, "class", "card-title fw-light");
    			add_location(h58, file, 302, 6, 9475);
    			attr_dev(h31, "class", "card-title fw-bold ");
    			add_location(h31, file, 303, 6, 9529);
    			attr_dev(div38, "class", "card-body");
    			add_location(div38, file, 301, 5, 9445);
    			attr_dev(div39, "class", "card svelte-1i9ap28");
    			add_location(div39, file, 300, 4, 9421);
    			attr_dev(div40, "class", "col-md-3 col-sm-12 mb-3");
    			add_location(div40, file, 299, 3, 9379);
    			attr_dev(h59, "class", "card-title fw-light");
    			add_location(h59, file, 310, 6, 9710);
    			attr_dev(h32, "class", "card-title fw-bold ");
    			add_location(h32, file, 311, 6, 9777);
    			attr_dev(div41, "class", "card-body");
    			add_location(div41, file, 309, 5, 9680);
    			attr_dev(div42, "class", "card svelte-1i9ap28");
    			add_location(div42, file, 308, 4, 9656);
    			attr_dev(div43, "class", "col-md-3 col-sm-12 mb-3");
    			add_location(div43, file, 307, 3, 9614);
    			attr_dev(div44, "class", "row align-items-center justify-content-center pb-5");
    			add_location(div44, file, 290, 2, 9074);
    			attr_dev(div45, "class", "container");
    			add_location(div45, file, 144, 1, 1760);
    			add_location(main, file, 141, 0, 1749);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div45);
    			append_dev(div45, div4);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			append_dev(div45, t13);
    			append_dev(div45, div9);
    			append_dev(div9, div8);
    			append_dev(div8, div7);
    			append_dev(div6, h51);
    			append_dev(div6, t15);
    			append_dev(div6, div5);
    			append_dev(div5, input4);
    			append_dev(div5, t16);
    			append_dev(div5, label4);
    			append_dev(div5, t18);
    			append_dev(div5, input5);
    			append_dev(div5, t19);
    			append_dev(div5, label5);
    			append_dev(div45, t21);
    			append_dev(div45, div14);
    			append_dev(div14, div13);
    			append_dev(div13, div12);
    			append_dev(div12, div11);
    			append_dev(div11, h52);
    			append_dev(h52, t22);
    			append_dev(h52, span);
    			append_dev(div11, t24);
    			append_dev(div11, div10);
    			append_dev(div10, input6);
    			append_dev(div10, t25);
    			append_dev(div10, label6);
    			append_dev(div10, t27);
    			append_dev(div10, input7);
    			append_dev(div10, t28);
    			append_dev(div10, label7);
    			append_dev(div45, t30);
    			append_dev(div45, div19);
    			append_dev(div19, div18);
    			append_dev(div18, div17);
    			append_dev(div17, div16);
    			append_dev(div16, h53);
    			append_dev(div16, t32);
    			append_dev(div16, div15);
    			append_dev(div15, input8);
    			append_dev(div15, t33);
    			append_dev(div15, label8);
    			append_dev(div15, t35);
    			append_dev(div15, input9);
    			append_dev(div15, t36);
    			append_dev(div15, label9);
    			append_dev(div45, t38);
    			append_dev(div45, div24);
    			append_dev(div24, div23);
    			append_dev(div23, div22);
    			append_dev(div22, div21);
    			append_dev(div21, h54);
    			append_dev(div21, t40);
    			append_dev(div21, div20);
    			append_dev(div20, input10);
    			append_dev(div20, t41);
    			append_dev(div20, label10);
    			append_dev(div20, t44);
    			append_dev(div20, input11);
    			append_dev(div20, t45);
    			append_dev(div20, label11);
    			append_dev(div20, t47);
    			append_dev(div20, input12);
    			append_dev(div20, t48);
    			append_dev(div20, label12);
    			append_dev(div20, t50);
    			append_dev(div20, input13);
    			append_dev(div20, t51);
    			append_dev(div20, label13);
    			append_dev(div45, t53);
    			append_dev(div20, input99);
    			append_dev(div20, t98);
    			append_dev(div20, label99);
    			append_dev(div45, t99);
    			append_dev(div45, div29);
    			append_dev(div29, div28);
    			append_dev(div28, div27);
    			append_dev(div27, div26);
    			append_dev(div26, h55);
    			append_dev(div26, t55);
    			append_dev(div26, div25);
    			append_dev(div25, input14);
    			append_dev(div25, t56);
    			append_dev(div25, t58);
    			append_dev(div25, input15);
    			append_dev(div25, t59);
    			append_dev(div25, label15);
    			append_dev(div25, t61);
    			append_dev(div25, input16);
    			append_dev(div25, t62);
    			append_dev(div25, label16);
    			append_dev(div45, t64);
    			append_dev(div45, div34);
    			append_dev(div34, div33);
    			append_dev(div33, div32);
    			append_dev(div31, h56);
    			append_dev(div31, t66);
    			append_dev(div31, div30);
    			append_dev(div30, input17);
    			append_dev(div30, t67);
    			append_dev(div30, label17);
    			append_dev(div30, t69);
    			append_dev(div30, input18);
    			append_dev(div30, t70);
    			append_dev(div30, label18);
    			append_dev(div30, t72);
    			append_dev(div30, input19);
    			append_dev(div30, t73);
    			append_dev(div30, label19);
    			append_dev(div45, t75);
    			append_dev(div45, div44);
    			append_dev(div44, div37);
    			append_dev(div37, div36);
    			append_dev(div36, div35);
    			append_dev(div35, h57);
    			append_dev(div35, t77);
    			append_dev(div35, h30);
    			append_dev(h30, t78);
    			append_dev(h30, t79);
    			append_dev(div44, t80);
    			append_dev(div44, div40);
    			append_dev(div40, div39);
    			append_dev(div39, div38);
    			append_dev(div38, h58);
    			append_dev(div38, t82);
    			append_dev(div38, h31);
    			append_dev(h31, t83);
    			append_dev(div44, t84);
    			append_dev(div44, div43);
    			append_dev(div43, div42);
    			append_dev(div42, div41);
    			append_dev(div41, h59);
    			append_dev(div41, t86);
    			append_dev(div41, h32);
    			append_dev(h32, t87);
    			append_dev(h32, t88);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "click", /*click_handler*/ ctx[6], false, false, false),
    					listen_dev(input1, "click", /*click_handler_1*/ ctx[7], false, false, false),
    					listen_dev(input2, "click", /*click_handler_2*/ ctx[8], false, false, false),
    					listen_dev(input3, "click", /*click_handler_3*/ ctx[9], false, false, false),
    					listen_dev(input4, "click", /*click_handler_4*/ ctx[10], false, false, false),
    					listen_dev(input5, "click", /*click_handler_5*/ ctx[11], false, false, false),
    					listen_dev(input6, "click", /*click_handler_6*/ ctx[12], false, false, false),
    					listen_dev(input7, "click", /*click_handler_7*/ ctx[13], false, false, false),
    					listen_dev(input8, "click", /*click_handler_8*/ ctx[14], false, false, false),
    					listen_dev(input9, "click", /*click_handler_9*/ ctx[15], false, false, false),
    					listen_dev(input10, "click", /*click_handler_10*/ ctx[16], false, false, false),
    					listen_dev(input11, "click", /*click_handler_11*/ ctx[17], false, false, false),
    					listen_dev(input12, "click", /*click_handler_12*/ ctx[18], false, false, false),
    					listen_dev(input13, "click", /*click_handler_13*/ ctx[19], false, false, false),
    					listen_dev(input99, "click", /*click_handler_20*/ ctx[26], false, false, false),
    					listen_dev(input14, "click", /*click_handler_14*/ ctx[20], false, false, false),
    					listen_dev(input15, "click", /*click_handler_15*/ ctx[21], false, false, false),
    					listen_dev(input16, "click", /*click_handler_16*/ ctx[22], false, false, false),
    					listen_dev(input17, "click", /*click_handler_17*/ ctx[23], false, false, false),
    					listen_dev(input18, "click", /*click_handler_18*/ ctx[24], false, false, false),
    					listen_dev(input19, "click", /*click_handler_19*/ ctx[25], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*score*/ 1) set_data_dev(t78, /*score*/ ctx[0]);
    			if (dirty & /*riskGroup*/ 2) set_data_dev(t83, /*riskGroup*/ ctx[1]);
    			if (dirty & /*probability*/ 4) set_data_dev(t87, /*probability*/ ctx[2]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function calculateRiskGroup(params) {
    	if (params <= 10) {
    		return "Non high risk";
    	} else if (params >= 11 && params <= 14) {
    		return "High";
    	} else if (params >= 14) {
    		return "Very High";
    	}
    }

    function instance($$self, $$props, $$invalidate) {
    	let score;
    	let riskGroup;
    	let probability;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let { name } = $$props;
    	var globalState = { age: 0, blood: 0 };

    	function extractProbability(params) {
    		var out;

    		probabilityMap.map(obj => {
    			if (obj.escore == params) {
    				out = obj.prob;
    			}
    		});

    		return out;
    	}

    	var probabilityMap = [
    		{ "escore": 0, "prob": 0.002 },
    		{ "escore": 1, "prob": 0.003 },
    		{ "escore": 2, "prob": 0.005 },
    		{ "escore": 3, "prob": 0.008 },
    		{ "escore": 4, "prob": 0.012 },
    		{ "escore": 5, "prob": 0.019 },
    		{ "escore": 6, "prob": 0.029 },
    		{ "escore": 7, "prob": 0.044 },
    		{ "escore": 8, "prob": 0.067 },
    		{ "escore": 9, "prob": 0.1 },
    		{ "escore": 10, "prob": 0.147 },
    		{ "escore": 11, "prob": 0.21 },
    		{ "escore": 12, "prob": 0.292 },
    		{ "escore": 13, "prob": 0.39 },
    		{ "escore": 14, "prob": 0.498 },
    		{ "escore": 15, "prob": 0.606 },
    		{ "escore": 16, "prob": 0.704 },
    		{ "escore": 17, "prob": 0.787 },
    		{ "escore": 18, "prob": 0.851 },
    		{ "escore": 19, "prob": 0.899 },
    		{ "escore": 20, "prob": 0.932 },
    		{ "escore": 21, "prob": 0.955 },
    		{ "escore": 22, "prob": 0.971 },
    		{ "escore": 23, "prob": 0.981 }

    	];

    	function changeGlobalState(params, value) {
    		$$invalidate(5, globalState = { ...globalState, [params]: value });
    		console.log(globalState);
    	}

    	const writable_props = ["name"];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => {
    		changeGlobalState("age", 0);
    	};

    	const click_handler_1 = () => {
    		changeGlobalState("age", 1);
    	};

    	const click_handler_2 = () => {
    		changeGlobalState("age", 3);
    	};

    	const click_handler_3 = () => {
    		changeGlobalState("age", 5);
    	};

    	const click_handler_4 = () => {
    		changeGlobalState("blood", 0);
    	};

    	const click_handler_5 = () => {
    		changeGlobalState("blood", 3);
    	};

    	const click_handler_6 = () => {
    		changeGlobalState("comorbidities", 0);
    	};

    	const click_handler_7 = () => {
    		changeGlobalState("comorbidities", 11);
    	};

    	const click_handler_8 = () => {
    		changeGlobalState("creative", 0);
    	};

    	const click_handler_9 = () => {
    		changeGlobalState("creative", 1);
    	};

    	const click_handler_10 = () => {
    		changeGlobalState("sfratio", 0);
    	};

    	const click_handler_11 = () => {
    		changeGlobalState("sfratio", 1);
    	};

    	const click_handler_12 = () => {
    		changeGlobalState("sfratio", 2);
    	};

    	const click_handler_13 = () => {
    		changeGlobalState("sfratio", 4);
    	};

    	const click_handler_20 = () => {
    		changeGlobalState("sfratio", 10);
    	};

    	const click_handler_14 = () => {
    		changeGlobalState("platet", 0);
    	};

    	const click_handler_15 = () => {
    		changeGlobalState("platet", 1);
    	};

    	const click_handler_16 = () => {
    		changeGlobalState("platet", 0);
    	};

    	const click_handler_17 = () => {
    		changeGlobalState("heart", 0);
    	};

    	const click_handler_18 = () => {
    		changeGlobalState("heart", 1);
    	};

    	const click_handler_19 = () => {
    		changeGlobalState("sfratio", 10);
    	};

    	$$self.$$set = $$props => {
    		if ("name" in $$props) $$invalidate(4, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({
    		name,
    		globalState,
    		extractProbability,
    		probabilityMap,
    		calculateRiskGroup,
    		changeGlobalState,
    		score,
    		riskGroup,
    		probability
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(4, name = $$props.name);
    		if ("globalState" in $$props) $$invalidate(5, globalState = $$props.globalState);
    		if ("probabilityMap" in $$props) probabilityMap = $$props.probabilityMap;
    		if ("score" in $$props) $$invalidate(0, score = $$props.score);
    		if ("riskGroup" in $$props) $$invalidate(1, riskGroup = $$props.riskGroup);
    		if ("probability" in $$props) $$invalidate(2, probability = $$props.probability);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*globalState*/ 32) {
    			 $$invalidate(0, score = Object.keys(globalState).reduce(
    				function (accumulator, key) {
    					return accumulator + globalState[key];
    				},
    				0
    			));
    		}

    		if ($$self.$$.dirty & /*score*/ 1) {
    			 $$invalidate(1, riskGroup = calculateRiskGroup(score));
    		}

    		if ($$self.$$.dirty & /*score*/ 1) {
    			 $$invalidate(2, probability = Math.round(extractProbability(score) * 100000) / 1000);
    		}
    	};

    	return [
    		score,
    		riskGroup,
    		probability,
    		changeGlobalState,
    		name,
    		globalState,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		click_handler_6,
    		click_handler_7,
    		click_handler_8,
    		click_handler_9,
    		click_handler_10,
    		click_handler_11,
    		click_handler_12,
    		click_handler_13,
    		click_handler_20,
    		click_handler_14,
    		click_handler_15,
    		click_handler_16,
    		click_handler_17,
    		click_handler_18,
    		click_handler_19
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { name: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[4] === undefined && !("name" in props)) {
    			console_1.warn("<App> was created without expected prop 'name'");
    		}
    	}

    	get name() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
