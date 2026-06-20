var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/@mavnn/codemirror-lang-ink/dist/index.js
var index_exports = {};
__export(index_exports, {
  InkLanguage: () => InkLanguage,
  InkLanguageSupport: () => InkLanguageSupport
});
export { InkLanguage, InkLanguageSupport };

// node_modules/@lezer/common/dist/index.js
var DefaultBufferLength = 1024;
var nextPropID = 0;
var Range = class {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }
};
var NodeProp = class {
  /**
  Create a new node prop type.
  */
  constructor(config = {}) {
    this.id = nextPropID++;
    this.perNode = !!config.perNode;
    this.deserialize = config.deserialize || (() => {
      throw new Error("This node type doesn't define a deserialize function");
    });
    this.combine = config.combine || null;
  }
  /**
  This is meant to be used with
  [`NodeSet.extend`](#common.NodeSet.extend) or
  [`LRParser.configure`](#lr.ParserConfig.props) to compute
  prop values for each node type in the set. Takes a [match
  object](#common.NodeType^match) or function that returns undefined
  if the node type doesn't get this prop, and the prop's value if
  it does.
  */
  add(match) {
    if (this.perNode)
      throw new RangeError("Can't add per-node props to node types");
    if (typeof match != "function")
      match = NodeType.match(match);
    return (type) => {
      let result = match(type);
      return result === void 0 ? null : [this, result];
    };
  }
};
NodeProp.closedBy = new NodeProp({ deserialize: (str) => str.split(" ") });
NodeProp.openedBy = new NodeProp({ deserialize: (str) => str.split(" ") });
NodeProp.group = new NodeProp({ deserialize: (str) => str.split(" ") });
NodeProp.isolate = new NodeProp({ deserialize: (value) => {
  if (value && value != "rtl" && value != "ltr" && value != "auto")
    throw new RangeError("Invalid value for isolate: " + value);
  return value || "auto";
} });
NodeProp.contextHash = new NodeProp({ perNode: true });
NodeProp.lookAhead = new NodeProp({ perNode: true });
NodeProp.mounted = new NodeProp({ perNode: true });
var MountedTree = class {
  constructor(tree, overlay, parser2, bracketed = false) {
    this.tree = tree;
    this.overlay = overlay;
    this.parser = parser2;
    this.bracketed = bracketed;
  }
  /**
  @internal
  */
  static get(tree) {
    return tree && tree.props && tree.props[NodeProp.mounted.id];
  }
};
var noProps = /* @__PURE__ */ Object.create(null);
var NodeType = class _NodeType {
  /**
  @internal
  */
  constructor(name2, props, id2, flags = 0) {
    this.name = name2;
    this.props = props;
    this.id = id2;
    this.flags = flags;
  }
  /**
  Define a node type.
  */
  static define(spec) {
    let props = spec.props && spec.props.length ? /* @__PURE__ */ Object.create(null) : noProps;
    let flags = (spec.top ? 1 : 0) | (spec.skipped ? 2 : 0) | (spec.error ? 4 : 0) | (spec.name == null ? 8 : 0);
    let type = new _NodeType(spec.name || "", props, spec.id, flags);
    if (spec.props)
      for (let src of spec.props) {
        if (!Array.isArray(src))
          src = src(type);
        if (src) {
          if (src[0].perNode)
            throw new RangeError("Can't store a per-node prop on a node type");
          props[src[0].id] = src[1];
        }
      }
    return type;
  }
  /**
  Retrieves a node prop for this type. Will return `undefined` if
  the prop isn't present on this node.
  */
  prop(prop) {
    return this.props[prop.id];
  }
  /**
  True when this is the top node of a grammar.
  */
  get isTop() {
    return (this.flags & 1) > 0;
  }
  /**
  True when this node is produced by a skip rule.
  */
  get isSkipped() {
    return (this.flags & 2) > 0;
  }
  /**
  Indicates whether this is an error node.
  */
  get isError() {
    return (this.flags & 4) > 0;
  }
  /**
  When true, this node type doesn't correspond to a user-declared
  named node, for example because it is used to cache repetition.
  */
  get isAnonymous() {
    return (this.flags & 8) > 0;
  }
  /**
  Returns true when this node's name or one of its
  [groups](#common.NodeProp^group) matches the given string.
  */
  is(name2) {
    if (typeof name2 == "string") {
      if (this.name == name2)
        return true;
      let group = this.prop(NodeProp.group);
      return group ? group.indexOf(name2) > -1 : false;
    }
    return this.id == name2;
  }
  /**
  Create a function from node types to arbitrary values by
  specifying an object whose property names are node or
  [group](#common.NodeProp^group) names. Often useful with
  [`NodeProp.add`](#common.NodeProp.add). You can put multiple
  names, separated by spaces, in a single property name to map
  multiple node names to a single value.
  */
  static match(map) {
    let direct = /* @__PURE__ */ Object.create(null);
    for (let prop in map)
      for (let name2 of prop.split(" "))
        direct[name2] = map[prop];
    return (node) => {
      for (let groups = node.prop(NodeProp.group), i = -1; i < (groups ? groups.length : 0); i++) {
        let found = direct[i < 0 ? node.name : groups[i]];
        if (found)
          return found;
      }
    };
  }
};
NodeType.none = new NodeType(
  "",
  /* @__PURE__ */ Object.create(null),
  0,
  8
  /* NodeFlag.Anonymous */
);
var NodeSet = class _NodeSet {
  /**
  Create a set with the given types. The `id` property of each
  type should correspond to its position within the array.
  */
  constructor(types) {
    this.types = types;
    for (let i = 0; i < types.length; i++)
      if (types[i].id != i)
        throw new RangeError("Node type ids should correspond to array positions when creating a node set");
  }
  /**
  Create a copy of this set with some node properties added. The
  arguments to this method can be created with
  [`NodeProp.add`](#common.NodeProp.add).
  */
  extend(...props) {
    let newTypes = [];
    for (let type of this.types) {
      let newProps = null;
      for (let source of props) {
        let add = source(type);
        if (add) {
          if (!newProps)
            newProps = Object.assign({}, type.props);
          let value = add[1], prop = add[0];
          if (prop.combine && prop.id in newProps)
            value = prop.combine(newProps[prop.id], value);
          newProps[prop.id] = value;
        }
      }
      newTypes.push(newProps ? new NodeType(type.name, newProps, type.id, type.flags) : type);
    }
    return new _NodeSet(newTypes);
  }
};
var CachedNode = /* @__PURE__ */ new WeakMap();
var CachedInnerNode = /* @__PURE__ */ new WeakMap();
var IterMode;
(function(IterMode2) {
  IterMode2[IterMode2["ExcludeBuffers"] = 1] = "ExcludeBuffers";
  IterMode2[IterMode2["IncludeAnonymous"] = 2] = "IncludeAnonymous";
  IterMode2[IterMode2["IgnoreMounts"] = 4] = "IgnoreMounts";
  IterMode2[IterMode2["IgnoreOverlays"] = 8] = "IgnoreOverlays";
  IterMode2[IterMode2["EnterBracketed"] = 16] = "EnterBracketed";
})(IterMode || (IterMode = {}));
var Tree = class _Tree {
  /**
  Construct a new tree. See also [`Tree.build`](#common.Tree^build).
  */
  constructor(type, children, positions, length, props) {
    this.type = type;
    this.children = children;
    this.positions = positions;
    this.length = length;
    this.props = null;
    if (props && props.length) {
      this.props = /* @__PURE__ */ Object.create(null);
      for (let [prop, value] of props)
        this.props[typeof prop == "number" ? prop : prop.id] = value;
    }
  }
  /**
  @internal
  */
  toString() {
    let mounted = MountedTree.get(this);
    if (mounted && !mounted.overlay)
      return mounted.tree.toString();
    let children = "";
    for (let ch of this.children) {
      let str = ch.toString();
      if (str) {
        if (children)
          children += ",";
        children += str;
      }
    }
    return !this.type.name ? children : (/\W/.test(this.type.name) && !this.type.isError ? JSON.stringify(this.type.name) : this.type.name) + (children.length ? "(" + children + ")" : "");
  }
  /**
  Get a [tree cursor](#common.TreeCursor) positioned at the top of
  the tree. Mode can be used to [control](#common.IterMode) which
  nodes the cursor visits.
  */
  cursor(mode = 0) {
    return new TreeCursor(this.topNode, mode);
  }
  /**
  Get a [tree cursor](#common.TreeCursor) pointing into this tree
  at the given position and side (see
  [`moveTo`](#common.TreeCursor.moveTo).
  */
  cursorAt(pos, side = 0, mode = 0) {
    let scope = CachedNode.get(this) || this.topNode;
    let cursor = new TreeCursor(scope);
    cursor.moveTo(pos, side);
    CachedNode.set(this, cursor._tree);
    return cursor;
  }
  /**
  Get a [syntax node](#common.SyntaxNode) object for the top of the
  tree.
  */
  get topNode() {
    return new TreeNode(this, 0, 0, null);
  }
  /**
  Get the [syntax node](#common.SyntaxNode) at the given position.
  If `side` is -1, this will move into nodes that end at the
  position. If 1, it'll move into nodes that start at the
  position. With 0, it'll only enter nodes that cover the position
  from both sides.
  
  Note that this will not enter
  [overlays](#common.MountedTree.overlay), and you often want
  [`resolveInner`](#common.Tree.resolveInner) instead.
  */
  resolve(pos, side = 0) {
    let node = resolveNode(CachedNode.get(this) || this.topNode, pos, side, false);
    CachedNode.set(this, node);
    return node;
  }
  /**
  Like [`resolve`](#common.Tree.resolve), but will enter
  [overlaid](#common.MountedTree.overlay) nodes, producing a syntax node
  pointing into the innermost overlaid tree at the given position
  (with parent links going through all parent structure, including
  the host trees).
  */
  resolveInner(pos, side = 0) {
    let node = resolveNode(CachedInnerNode.get(this) || this.topNode, pos, side, true);
    CachedInnerNode.set(this, node);
    return node;
  }
  /**
  In some situations, it can be useful to iterate through all
  nodes around a position, including those in overlays that don't
  directly cover the position. This method gives you an iterator
  that will produce all nodes, from small to big, around the given
  position.
  */
  resolveStack(pos, side = 0) {
    return stackIterator(this, pos, side);
  }
  /**
  Iterate over the tree and its children, calling `enter` for any
  node that touches the `from`/`to` region (if given) before
  running over such a node's children, and `leave` (if given) when
  leaving the node. When `enter` returns `false`, that node will
  not have its children iterated over (or `leave` called).
  */
  iterate(spec) {
    let { enter, leave, from = 0, to = this.length } = spec;
    let mode = spec.mode || 0, anon = (mode & IterMode.IncludeAnonymous) > 0;
    for (let c = this.cursor(mode | IterMode.IncludeAnonymous); ; ) {
      let entered = false;
      if (c.from <= to && c.to >= from && (!anon && c.type.isAnonymous || enter(c) !== false)) {
        if (c.firstChild())
          continue;
        entered = true;
      }
      for (; ; ) {
        if (entered && leave && (anon || !c.type.isAnonymous))
          leave(c);
        if (c.nextSibling())
          break;
        if (!c.parent())
          return;
        entered = true;
      }
    }
  }
  /**
  Get the value of the given [node prop](#common.NodeProp) for this
  node. Works with both per-node and per-type props.
  */
  prop(prop) {
    return !prop.perNode ? this.type.prop(prop) : this.props ? this.props[prop.id] : void 0;
  }
  /**
  Returns the node's [per-node props](#common.NodeProp.perNode) in a
  format that can be passed to the [`Tree`](#common.Tree)
  constructor.
  */
  get propValues() {
    let result = [];
    if (this.props)
      for (let id2 in this.props)
        result.push([+id2, this.props[id2]]);
    return result;
  }
  /**
  Balance the direct children of this tree, producing a copy of
  which may have children grouped into subtrees with type
  [`NodeType.none`](#common.NodeType^none).
  */
  balance(config = {}) {
    return this.children.length <= 8 ? this : balanceRange(NodeType.none, this.children, this.positions, 0, this.children.length, 0, this.length, (children, positions, length) => new _Tree(this.type, children, positions, length, this.propValues), config.makeTree || ((children, positions, length) => new _Tree(NodeType.none, children, positions, length)));
  }
  /**
  Build a tree from a postfix-ordered buffer of node information,
  or a cursor over such a buffer.
  */
  static build(data) {
    return buildTree(data);
  }
};
Tree.empty = new Tree(NodeType.none, [], [], 0);
var FlatBufferCursor = class _FlatBufferCursor {
  constructor(buffer, index) {
    this.buffer = buffer;
    this.index = index;
  }
  get id() {
    return this.buffer[this.index - 4];
  }
  get start() {
    return this.buffer[this.index - 3];
  }
  get end() {
    return this.buffer[this.index - 2];
  }
  get size() {
    return this.buffer[this.index - 1];
  }
  get pos() {
    return this.index;
  }
  next() {
    this.index -= 4;
  }
  fork() {
    return new _FlatBufferCursor(this.buffer, this.index);
  }
};
var TreeBuffer = class _TreeBuffer {
  /**
  Create a tree buffer.
  */
  constructor(buffer, length, set) {
    this.buffer = buffer;
    this.length = length;
    this.set = set;
  }
  /**
  @internal
  */
  get type() {
    return NodeType.none;
  }
  /**
  @internal
  */
  toString() {
    let result = [];
    for (let index = 0; index < this.buffer.length; ) {
      result.push(this.childString(index));
      index = this.buffer[index + 3];
    }
    return result.join(",");
  }
  /**
  @internal
  */
  childString(index) {
    let id2 = this.buffer[index], endIndex = this.buffer[index + 3];
    let type = this.set.types[id2], result = type.name;
    if (/\W/.test(result) && !type.isError)
      result = JSON.stringify(result);
    index += 4;
    if (endIndex == index)
      return result;
    let children = [];
    while (index < endIndex) {
      children.push(this.childString(index));
      index = this.buffer[index + 3];
    }
    return result + "(" + children.join(",") + ")";
  }
  /**
  @internal
  */
  findChild(startIndex, endIndex, dir, pos, side) {
    let { buffer } = this, pick = -1;
    for (let i = startIndex; i != endIndex; i = buffer[i + 3]) {
      if (checkSide(side, pos, buffer[i + 1], buffer[i + 2])) {
        pick = i;
        if (dir > 0)
          break;
      }
    }
    return pick;
  }
  /**
  @internal
  */
  slice(startI, endI, from) {
    let b = this.buffer;
    let copy = new Uint16Array(endI - startI), len = 0;
    for (let i = startI, j = 0; i < endI; ) {
      copy[j++] = b[i++];
      copy[j++] = b[i++] - from;
      let to = copy[j++] = b[i++] - from;
      copy[j++] = b[i++] - startI;
      len = Math.max(len, to);
    }
    return new _TreeBuffer(copy, len, this.set);
  }
};
function checkSide(side, pos, from, to) {
  switch (side) {
    case -2:
      return from < pos;
    case -1:
      return to >= pos && from < pos;
    case 0:
      return from < pos && to > pos;
    case 1:
      return from <= pos && to > pos;
    case 2:
      return to > pos;
    case 4:
      return true;
  }
}
function resolveNode(node, pos, side, overlays) {
  var _a;
  while (node.from == node.to || (side < 1 ? node.from >= pos : node.from > pos) || (side > -1 ? node.to <= pos : node.to < pos)) {
    let parent = !overlays && node instanceof TreeNode && node.index < 0 ? null : node.parent;
    if (!parent)
      return node;
    node = parent;
  }
  let mode = overlays ? 0 : IterMode.IgnoreOverlays;
  if (overlays)
    for (let scan = node, parent = scan.parent; parent; scan = parent, parent = scan.parent) {
      if (scan instanceof TreeNode && scan.index < 0 && ((_a = parent.enter(pos, side, mode)) === null || _a === void 0 ? void 0 : _a.from) != scan.from)
        node = parent;
    }
  for (; ; ) {
    let inner = node.enter(pos, side, mode);
    if (!inner)
      return node;
    node = inner;
  }
}
var BaseNode = class {
  cursor(mode = 0) {
    return new TreeCursor(this, mode);
  }
  getChild(type, before = null, after = null) {
    let r = getChildren(this, type, before, after);
    return r.length ? r[0] : null;
  }
  getChildren(type, before = null, after = null) {
    return getChildren(this, type, before, after);
  }
  resolve(pos, side = 0) {
    return resolveNode(this, pos, side, false);
  }
  resolveInner(pos, side = 0) {
    return resolveNode(this, pos, side, true);
  }
  matchContext(context) {
    return matchNodeContext(this.parent, context);
  }
  enterUnfinishedNodesBefore(pos) {
    let scan = this.childBefore(pos), node = this;
    while (scan) {
      let last = scan.lastChild;
      if (!last || last.to != scan.to)
        break;
      if (last.type.isError && last.from == last.to) {
        node = scan;
        scan = last.prevSibling;
      } else {
        scan = last;
      }
    }
    return node;
  }
  get node() {
    return this;
  }
  get next() {
    return this.parent;
  }
};
var TreeNode = class _TreeNode extends BaseNode {
  constructor(_tree, from, index, _parent) {
    super();
    this._tree = _tree;
    this.from = from;
    this.index = index;
    this._parent = _parent;
  }
  get type() {
    return this._tree.type;
  }
  get name() {
    return this._tree.type.name;
  }
  get to() {
    return this.from + this._tree.length;
  }
  nextChild(i, dir, pos, side, mode = 0) {
    for (let parent = this; ; ) {
      for (let { children, positions } = parent._tree, e = dir > 0 ? children.length : -1; i != e; i += dir) {
        let next = children[i], start = positions[i] + parent.from, mounted;
        if (!(mode & IterMode.EnterBracketed && next instanceof Tree && (mounted = MountedTree.get(next)) && !mounted.overlay && mounted.bracketed && pos >= start && pos <= start + next.length) && !checkSide(side, pos, start, start + next.length))
          continue;
        if (next instanceof TreeBuffer) {
          if (mode & IterMode.ExcludeBuffers)
            continue;
          let index = next.findChild(0, next.buffer.length, dir, pos - start, side);
          if (index > -1)
            return new BufferNode(new BufferContext(parent, next, i, start), null, index);
        } else if (mode & IterMode.IncludeAnonymous || (!next.type.isAnonymous || hasChild(next))) {
          let mounted2;
          if (!(mode & IterMode.IgnoreMounts) && (mounted2 = MountedTree.get(next)) && !mounted2.overlay)
            return new _TreeNode(mounted2.tree, start, i, parent);
          let inner = new _TreeNode(next, start, i, parent);
          return mode & IterMode.IncludeAnonymous || !inner.type.isAnonymous ? inner : inner.nextChild(dir < 0 ? next.children.length - 1 : 0, dir, pos, side, mode);
        }
      }
      if (mode & IterMode.IncludeAnonymous || !parent.type.isAnonymous)
        return null;
      if (parent.index >= 0)
        i = parent.index + dir;
      else
        i = dir < 0 ? -1 : parent._parent._tree.children.length;
      parent = parent._parent;
      if (!parent)
        return null;
    }
  }
  get firstChild() {
    return this.nextChild(
      0,
      1,
      0,
      4
      /* Side.DontCare */
    );
  }
  get lastChild() {
    return this.nextChild(
      this._tree.children.length - 1,
      -1,
      0,
      4
      /* Side.DontCare */
    );
  }
  childAfter(pos) {
    return this.nextChild(
      0,
      1,
      pos,
      2
      /* Side.After */
    );
  }
  childBefore(pos) {
    return this.nextChild(
      this._tree.children.length - 1,
      -1,
      pos,
      -2
      /* Side.Before */
    );
  }
  prop(prop) {
    return this._tree.prop(prop);
  }
  enter(pos, side, mode = 0) {
    let mounted;
    if (!(mode & IterMode.IgnoreOverlays) && (mounted = MountedTree.get(this._tree)) && mounted.overlay) {
      let rPos = pos - this.from, enterBracketed = mode & IterMode.EnterBracketed && mounted.bracketed;
      for (let { from, to } of mounted.overlay) {
        if ((side > 0 || enterBracketed ? from <= rPos : from < rPos) && (side < 0 || enterBracketed ? to >= rPos : to > rPos))
          return new _TreeNode(mounted.tree, mounted.overlay[0].from + this.from, -1, this);
      }
    }
    return this.nextChild(0, 1, pos, side, mode);
  }
  nextSignificantParent() {
    let val = this;
    while (val.type.isAnonymous && val._parent)
      val = val._parent;
    return val;
  }
  get parent() {
    return this._parent ? this._parent.nextSignificantParent() : null;
  }
  get nextSibling() {
    return this._parent && this.index >= 0 ? this._parent.nextChild(
      this.index + 1,
      1,
      0,
      4
      /* Side.DontCare */
    ) : null;
  }
  get prevSibling() {
    return this._parent && this.index >= 0 ? this._parent.nextChild(
      this.index - 1,
      -1,
      0,
      4
      /* Side.DontCare */
    ) : null;
  }
  get tree() {
    return this._tree;
  }
  toTree() {
    return this._tree;
  }
  /**
  @internal
  */
  toString() {
    return this._tree.toString();
  }
};
function getChildren(node, type, before, after) {
  let cur = node.cursor(), result = [];
  if (!cur.firstChild())
    return result;
  if (before != null)
    for (let found = false; !found; ) {
      found = cur.type.is(before);
      if (!cur.nextSibling())
        return result;
    }
  for (; ; ) {
    if (after != null && cur.type.is(after))
      return result;
    if (cur.type.is(type))
      result.push(cur.node);
    if (!cur.nextSibling())
      return after == null ? result : [];
  }
}
function matchNodeContext(node, context, i = context.length - 1) {
  for (let p = node; i >= 0; p = p.parent) {
    if (!p)
      return false;
    if (!p.type.isAnonymous) {
      if (context[i] && context[i] != p.name)
        return false;
      i--;
    }
  }
  return true;
}
var BufferContext = class {
  constructor(parent, buffer, index, start) {
    this.parent = parent;
    this.buffer = buffer;
    this.index = index;
    this.start = start;
  }
};
var BufferNode = class _BufferNode extends BaseNode {
  get name() {
    return this.type.name;
  }
  get from() {
    return this.context.start + this.context.buffer.buffer[this.index + 1];
  }
  get to() {
    return this.context.start + this.context.buffer.buffer[this.index + 2];
  }
  constructor(context, _parent, index) {
    super();
    this.context = context;
    this._parent = _parent;
    this.index = index;
    this.type = context.buffer.set.types[context.buffer.buffer[index]];
  }
  child(dir, pos, side) {
    let { buffer } = this.context;
    let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], dir, pos - this.context.start, side);
    return index < 0 ? null : new _BufferNode(this.context, this, index);
  }
  get firstChild() {
    return this.child(
      1,
      0,
      4
      /* Side.DontCare */
    );
  }
  get lastChild() {
    return this.child(
      -1,
      0,
      4
      /* Side.DontCare */
    );
  }
  childAfter(pos) {
    return this.child(
      1,
      pos,
      2
      /* Side.After */
    );
  }
  childBefore(pos) {
    return this.child(
      -1,
      pos,
      -2
      /* Side.Before */
    );
  }
  prop(prop) {
    return this.type.prop(prop);
  }
  enter(pos, side, mode = 0) {
    if (mode & IterMode.ExcludeBuffers)
      return null;
    let { buffer } = this.context;
    let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], side > 0 ? 1 : -1, pos - this.context.start, side);
    return index < 0 ? null : new _BufferNode(this.context, this, index);
  }
  get parent() {
    return this._parent || this.context.parent.nextSignificantParent();
  }
  externalSibling(dir) {
    return this._parent ? null : this.context.parent.nextChild(
      this.context.index + dir,
      dir,
      0,
      4
      /* Side.DontCare */
    );
  }
  get nextSibling() {
    let { buffer } = this.context;
    let after = buffer.buffer[this.index + 3];
    if (after < (this._parent ? buffer.buffer[this._parent.index + 3] : buffer.buffer.length))
      return new _BufferNode(this.context, this._parent, after);
    return this.externalSibling(1);
  }
  get prevSibling() {
    let { buffer } = this.context;
    let parentStart = this._parent ? this._parent.index + 4 : 0;
    if (this.index == parentStart)
      return this.externalSibling(-1);
    return new _BufferNode(this.context, this._parent, buffer.findChild(
      parentStart,
      this.index,
      -1,
      0,
      4
      /* Side.DontCare */
    ));
  }
  get tree() {
    return null;
  }
  toTree() {
    let children = [], positions = [];
    let { buffer } = this.context;
    let startI = this.index + 4, endI = buffer.buffer[this.index + 3];
    if (endI > startI) {
      let from = buffer.buffer[this.index + 1];
      children.push(buffer.slice(startI, endI, from));
      positions.push(0);
    }
    return new Tree(this.type, children, positions, this.to - this.from);
  }
  /**
  @internal
  */
  toString() {
    return this.context.buffer.childString(this.index);
  }
};
function iterStack(heads) {
  if (!heads.length)
    return null;
  let pick = 0, picked = heads[0];
  for (let i = 1; i < heads.length; i++) {
    let node = heads[i];
    if (node.from > picked.from || node.to < picked.to) {
      picked = node;
      pick = i;
    }
  }
  let next = picked instanceof TreeNode && picked.index < 0 ? null : picked.parent;
  let newHeads = heads.slice();
  if (next)
    newHeads[pick] = next;
  else
    newHeads.splice(pick, 1);
  return new StackIterator(newHeads, picked);
}
var StackIterator = class {
  constructor(heads, node) {
    this.heads = heads;
    this.node = node;
  }
  get next() {
    return iterStack(this.heads);
  }
};
function stackIterator(tree, pos, side) {
  let inner = tree.resolveInner(pos, side), layers = null;
  for (let scan = inner instanceof TreeNode ? inner : inner.context.parent; scan; scan = scan.parent) {
    if (scan.index < 0) {
      let parent = scan.parent;
      (layers || (layers = [inner])).push(parent.resolve(pos, side));
      scan = parent;
    } else {
      let mount = MountedTree.get(scan.tree);
      if (mount && mount.overlay && mount.overlay[0].from <= pos && mount.overlay[mount.overlay.length - 1].to >= pos) {
        let root = new TreeNode(mount.tree, mount.overlay[0].from + scan.from, -1, scan);
        (layers || (layers = [inner])).push(resolveNode(root, pos, side, false));
      }
    }
  }
  return layers ? iterStack(layers) : inner;
}
var TreeCursor = class {
  /**
  Shorthand for `.type.name`.
  */
  get name() {
    return this.type.name;
  }
  /**
  @internal
  */
  constructor(node, mode = 0) {
    this.buffer = null;
    this.stack = [];
    this.index = 0;
    this.bufferNode = null;
    this.mode = mode & ~IterMode.EnterBracketed;
    if (node instanceof TreeNode) {
      this.yieldNode(node);
    } else {
      this._tree = node.context.parent;
      this.buffer = node.context;
      for (let n = node._parent; n; n = n._parent)
        this.stack.unshift(n.index);
      this.bufferNode = node;
      this.yieldBuf(node.index);
    }
  }
  yieldNode(node) {
    if (!node)
      return false;
    this._tree = node;
    this.type = node.type;
    this.from = node.from;
    this.to = node.to;
    return true;
  }
  yieldBuf(index, type) {
    this.index = index;
    let { start, buffer } = this.buffer;
    this.type = type || buffer.set.types[buffer.buffer[index]];
    this.from = start + buffer.buffer[index + 1];
    this.to = start + buffer.buffer[index + 2];
    return true;
  }
  /**
  @internal
  */
  yield(node) {
    if (!node)
      return false;
    if (node instanceof TreeNode) {
      this.buffer = null;
      return this.yieldNode(node);
    }
    this.buffer = node.context;
    return this.yieldBuf(node.index, node.type);
  }
  /**
  @internal
  */
  toString() {
    return this.buffer ? this.buffer.buffer.childString(this.index) : this._tree.toString();
  }
  /**
  @internal
  */
  enterChild(dir, pos, side) {
    if (!this.buffer)
      return this.yield(this._tree.nextChild(dir < 0 ? this._tree._tree.children.length - 1 : 0, dir, pos, side, this.mode));
    let { buffer } = this.buffer;
    let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], dir, pos - this.buffer.start, side);
    if (index < 0)
      return false;
    this.stack.push(this.index);
    return this.yieldBuf(index);
  }
  /**
  Move the cursor to this node's first child. When this returns
  false, the node has no child, and the cursor has not been moved.
  */
  firstChild() {
    return this.enterChild(
      1,
      0,
      4
      /* Side.DontCare */
    );
  }
  /**
  Move the cursor to this node's last child.
  */
  lastChild() {
    return this.enterChild(
      -1,
      0,
      4
      /* Side.DontCare */
    );
  }
  /**
  Move the cursor to the first child that ends after `pos`.
  */
  childAfter(pos) {
    return this.enterChild(
      1,
      pos,
      2
      /* Side.After */
    );
  }
  /**
  Move to the last child that starts before `pos`.
  */
  childBefore(pos) {
    return this.enterChild(
      -1,
      pos,
      -2
      /* Side.Before */
    );
  }
  /**
  Move the cursor to the child around `pos`. If side is -1 the
  child may end at that position, when 1 it may start there. This
  will also enter [overlaid](#common.MountedTree.overlay)
  [mounted](#common.NodeProp^mounted) trees unless `overlays` is
  set to false.
  */
  enter(pos, side, mode = this.mode) {
    if (!this.buffer)
      return this.yield(this._tree.enter(pos, side, mode));
    return mode & IterMode.ExcludeBuffers ? false : this.enterChild(1, pos, side);
  }
  /**
  Move to the node's parent node, if this isn't the top node.
  */
  parent() {
    if (!this.buffer)
      return this.yieldNode(this.mode & IterMode.IncludeAnonymous ? this._tree._parent : this._tree.parent);
    if (this.stack.length)
      return this.yieldBuf(this.stack.pop());
    let parent = this.mode & IterMode.IncludeAnonymous ? this.buffer.parent : this.buffer.parent.nextSignificantParent();
    this.buffer = null;
    return this.yieldNode(parent);
  }
  /**
  @internal
  */
  sibling(dir) {
    if (!this.buffer)
      return !this._tree._parent ? false : this.yield(this._tree.index < 0 ? null : this._tree._parent.nextChild(this._tree.index + dir, dir, 0, 4, this.mode));
    let { buffer } = this.buffer, d = this.stack.length - 1;
    if (dir < 0) {
      let parentStart = d < 0 ? 0 : this.stack[d] + 4;
      if (this.index != parentStart)
        return this.yieldBuf(buffer.findChild(
          parentStart,
          this.index,
          -1,
          0,
          4
          /* Side.DontCare */
        ));
    } else {
      let after = buffer.buffer[this.index + 3];
      if (after < (d < 0 ? buffer.buffer.length : buffer.buffer[this.stack[d] + 3]))
        return this.yieldBuf(after);
    }
    return d < 0 ? this.yield(this.buffer.parent.nextChild(this.buffer.index + dir, dir, 0, 4, this.mode)) : false;
  }
  /**
  Move to this node's next sibling, if any.
  */
  nextSibling() {
    return this.sibling(1);
  }
  /**
  Move to this node's previous sibling, if any.
  */
  prevSibling() {
    return this.sibling(-1);
  }
  atLastNode(dir) {
    let index, parent, { buffer } = this;
    if (buffer) {
      if (dir > 0) {
        if (this.index < buffer.buffer.buffer.length)
          return false;
      } else {
        for (let i = 0; i < this.index; i++)
          if (buffer.buffer.buffer[i + 3] < this.index)
            return false;
      }
      ({ index, parent } = buffer);
    } else {
      ({ index, _parent: parent } = this._tree);
    }
    for (; parent; { index, _parent: parent } = parent) {
      if (index > -1)
        for (let i = index + dir, e = dir < 0 ? -1 : parent._tree.children.length; i != e; i += dir) {
          let child = parent._tree.children[i];
          if (this.mode & IterMode.IncludeAnonymous || child instanceof TreeBuffer || !child.type.isAnonymous || hasChild(child))
            return false;
        }
    }
    return true;
  }
  move(dir, enter) {
    if (enter && this.enterChild(
      dir,
      0,
      4
      /* Side.DontCare */
    ))
      return true;
    for (; ; ) {
      if (this.sibling(dir))
        return true;
      if (this.atLastNode(dir) || !this.parent())
        return false;
    }
  }
  /**
  Move to the next node in a
  [pre-order](https://en.wikipedia.org/wiki/Tree_traversal#Pre-order,_NLR)
  traversal, going from a node to its first child or, if the
  current node is empty or `enter` is false, its next sibling or
  the next sibling of the first parent node that has one.
  */
  next(enter = true) {
    return this.move(1, enter);
  }
  /**
  Move to the next node in a last-to-first pre-order traversal. A
  node is followed by its last child or, if it has none, its
  previous sibling or the previous sibling of the first parent
  node that has one.
  */
  prev(enter = true) {
    return this.move(-1, enter);
  }
  /**
  Move the cursor to the innermost node that covers `pos`. If
  `side` is -1, it will enter nodes that end at `pos`. If it is 1,
  it will enter nodes that start at `pos`.
  */
  moveTo(pos, side = 0) {
    while (this.from == this.to || (side < 1 ? this.from >= pos : this.from > pos) || (side > -1 ? this.to <= pos : this.to < pos))
      if (!this.parent())
        break;
    while (this.enterChild(1, pos, side)) {
    }
    return this;
  }
  /**
  Get a [syntax node](#common.SyntaxNode) at the cursor's current
  position.
  */
  get node() {
    if (!this.buffer)
      return this._tree;
    let cache = this.bufferNode, result = null, depth = 0;
    if (cache && cache.context == this.buffer) {
      scan: for (let index = this.index, d = this.stack.length; d >= 0; ) {
        for (let c = cache; c; c = c._parent)
          if (c.index == index) {
            if (index == this.index)
              return c;
            result = c;
            depth = d + 1;
            break scan;
          }
        index = this.stack[--d];
      }
    }
    for (let i = depth; i < this.stack.length; i++)
      result = new BufferNode(this.buffer, result, this.stack[i]);
    return this.bufferNode = new BufferNode(this.buffer, result, this.index);
  }
  /**
  Get the [tree](#common.Tree) that represents the current node, if
  any. Will return null when the node is in a [tree
  buffer](#common.TreeBuffer).
  */
  get tree() {
    return this.buffer ? null : this._tree._tree;
  }
  /**
  Iterate over the current node and all its descendants, calling
  `enter` when entering a node and `leave`, if given, when leaving
  one. When `enter` returns `false`, any children of that node are
  skipped, and `leave` isn't called for it.
  */
  iterate(enter, leave) {
    for (let depth = 0; ; ) {
      let mustLeave = false;
      if (this.type.isAnonymous || enter(this) !== false) {
        if (this.firstChild()) {
          depth++;
          continue;
        }
        if (!this.type.isAnonymous)
          mustLeave = true;
      }
      for (; ; ) {
        if (mustLeave && leave)
          leave(this);
        mustLeave = this.type.isAnonymous;
        if (!depth)
          return;
        if (this.nextSibling())
          break;
        this.parent();
        depth--;
        mustLeave = true;
      }
    }
  }
  /**
  Test whether the current node matches a given context—a sequence
  of direct parent node names. Empty strings in the context array
  are treated as wildcards.
  */
  matchContext(context) {
    if (!this.buffer)
      return matchNodeContext(this.node.parent, context);
    let { buffer } = this.buffer, { types } = buffer.set;
    for (let i = context.length - 1, d = this.stack.length - 1; i >= 0; d--) {
      if (d < 0)
        return matchNodeContext(this._tree, context, i);
      let type = types[buffer.buffer[this.stack[d]]];
      if (!type.isAnonymous) {
        if (context[i] && context[i] != type.name)
          return false;
        i--;
      }
    }
    return true;
  }
};
function hasChild(tree) {
  return tree.children.some((ch) => ch instanceof TreeBuffer || !ch.type.isAnonymous || hasChild(ch));
}
function buildTree(data) {
  var _a;
  let { buffer, nodeSet, maxBufferLength = DefaultBufferLength, reused = [], minRepeatType = nodeSet.types.length } = data;
  let cursor = Array.isArray(buffer) ? new FlatBufferCursor(buffer, buffer.length) : buffer;
  let types = nodeSet.types;
  let contextHash = 0, lookAhead = 0;
  function takeNode(parentStart, minPos, children2, positions2, inRepeat, depth) {
    let { id: id2, start, end, size } = cursor;
    let lookAheadAtStart = lookAhead, contextAtStart = contextHash;
    if (size < 0) {
      cursor.next();
      if (size == -1) {
        let node2 = reused[id2];
        children2.push(node2);
        positions2.push(start - parentStart);
        return;
      } else if (size == -3) {
        contextHash = id2;
        return;
      } else if (size == -4) {
        lookAhead = id2;
        return;
      } else {
        throw new RangeError(`Unrecognized record size: ${size}`);
      }
    }
    let type = types[id2], node, buffer2;
    let startPos = start - parentStart;
    if (end - start <= maxBufferLength && (buffer2 = findBufferSize(cursor.pos - minPos, inRepeat))) {
      let data2 = new Uint16Array(buffer2.size - buffer2.skip);
      let endPos = cursor.pos - buffer2.size, index = data2.length;
      while (cursor.pos > endPos)
        index = copyToBuffer(buffer2.start, data2, index);
      node = new TreeBuffer(data2, end - buffer2.start, nodeSet);
      startPos = buffer2.start - parentStart;
    } else {
      let endPos = cursor.pos - size;
      cursor.next();
      let localChildren = [], localPositions = [];
      let localInRepeat = id2 >= minRepeatType ? id2 : -1;
      let lastGroup = 0, lastEnd = end;
      while (cursor.pos > endPos) {
        if (localInRepeat >= 0 && cursor.id == localInRepeat && cursor.size >= 0) {
          if (cursor.end <= lastEnd - maxBufferLength) {
            makeRepeatLeaf(localChildren, localPositions, start, lastGroup, cursor.end, lastEnd, localInRepeat, lookAheadAtStart, contextAtStart);
            lastGroup = localChildren.length;
            lastEnd = cursor.end;
          }
          cursor.next();
        } else if (depth > 2500) {
          takeFlatNode(start, endPos, localChildren, localPositions);
        } else {
          takeNode(start, endPos, localChildren, localPositions, localInRepeat, depth + 1);
        }
      }
      if (localInRepeat >= 0 && lastGroup > 0 && lastGroup < localChildren.length)
        makeRepeatLeaf(localChildren, localPositions, start, lastGroup, start, lastEnd, localInRepeat, lookAheadAtStart, contextAtStart);
      localChildren.reverse();
      localPositions.reverse();
      if (localInRepeat > -1 && lastGroup > 0) {
        let make = makeBalanced(type, contextAtStart);
        node = balanceRange(type, localChildren, localPositions, 0, localChildren.length, 0, end - start, make, make);
      } else {
        node = makeTree(type, localChildren, localPositions, end - start, lookAheadAtStart - end, contextAtStart);
      }
    }
    children2.push(node);
    positions2.push(startPos);
  }
  function takeFlatNode(parentStart, minPos, children2, positions2) {
    let nodes = [];
    let nodeCount = 0, stopAt = -1;
    while (cursor.pos > minPos) {
      let { id: id2, start, end, size } = cursor;
      if (size > 4) {
        cursor.next();
      } else if (stopAt > -1 && start < stopAt) {
        break;
      } else {
        if (stopAt < 0)
          stopAt = end - maxBufferLength;
        nodes.push(id2, start, end);
        nodeCount++;
        cursor.next();
      }
    }
    if (nodeCount) {
      let buffer2 = new Uint16Array(nodeCount * 4);
      let start = nodes[nodes.length - 2];
      for (let i = nodes.length - 3, j = 0; i >= 0; i -= 3) {
        buffer2[j++] = nodes[i];
        buffer2[j++] = nodes[i + 1] - start;
        buffer2[j++] = nodes[i + 2] - start;
        buffer2[j++] = j;
      }
      children2.push(new TreeBuffer(buffer2, nodes[2] - start, nodeSet));
      positions2.push(start - parentStart);
    }
  }
  function makeBalanced(type, contextHash2) {
    return (children2, positions2, length2) => {
      let lookAhead2 = 0, lastI = children2.length - 1, last, lookAheadProp;
      if (lastI >= 0 && (last = children2[lastI]) instanceof Tree) {
        if (!lastI && last.type == type && last.length == length2)
          return last;
        if (lookAheadProp = last.prop(NodeProp.lookAhead))
          lookAhead2 = positions2[lastI] + last.length + lookAheadProp;
      }
      return makeTree(type, children2, positions2, length2, lookAhead2, contextHash2);
    };
  }
  function makeRepeatLeaf(children2, positions2, base, i, from, to, type, lookAhead2, contextHash2) {
    let localChildren = [], localPositions = [];
    while (children2.length > i) {
      localChildren.push(children2.pop());
      localPositions.push(positions2.pop() + base - from);
    }
    children2.push(makeTree(nodeSet.types[type], localChildren, localPositions, to - from, lookAhead2 - to, contextHash2));
    positions2.push(from - base);
  }
  function makeTree(type, children2, positions2, length2, lookAhead2, contextHash2, props) {
    if (contextHash2) {
      let pair2 = [NodeProp.contextHash, contextHash2];
      props = props ? [pair2].concat(props) : [pair2];
    }
    if (lookAhead2 > 25) {
      let pair2 = [NodeProp.lookAhead, lookAhead2];
      props = props ? [pair2].concat(props) : [pair2];
    }
    return new Tree(type, children2, positions2, length2, props);
  }
  function findBufferSize(maxSize, inRepeat) {
    let fork = cursor.fork();
    let size = 0, start = 0, skip = 0, minStart = fork.end - maxBufferLength;
    let result = { size: 0, start: 0, skip: 0 };
    scan: for (let minPos = fork.pos - maxSize; fork.pos > minPos; ) {
      let nodeSize2 = fork.size;
      if (fork.id == inRepeat && nodeSize2 >= 0) {
        result.size = size;
        result.start = start;
        result.skip = skip;
        skip += 4;
        size += 4;
        fork.next();
        continue;
      }
      let startPos = fork.pos - nodeSize2;
      if (nodeSize2 < 0 || startPos < minPos || fork.start < minStart)
        break;
      let localSkipped = fork.id >= minRepeatType ? 4 : 0;
      let nodeStart = fork.start;
      fork.next();
      while (fork.pos > startPos) {
        if (fork.size < 0) {
          if (fork.size == -3 || fork.size == -4)
            localSkipped += 4;
          else
            break scan;
        } else if (fork.id >= minRepeatType) {
          localSkipped += 4;
        }
        fork.next();
      }
      start = nodeStart;
      size += nodeSize2;
      skip += localSkipped;
    }
    if (inRepeat < 0 || size == maxSize) {
      result.size = size;
      result.start = start;
      result.skip = skip;
    }
    return result.size > 4 ? result : void 0;
  }
  function copyToBuffer(bufferStart, buffer2, index) {
    let { id: id2, start, end, size } = cursor;
    cursor.next();
    if (size >= 0 && id2 < minRepeatType) {
      let startIndex = index;
      if (size > 4) {
        let endPos = cursor.pos - (size - 4);
        while (cursor.pos > endPos)
          index = copyToBuffer(bufferStart, buffer2, index);
      }
      buffer2[--index] = startIndex;
      buffer2[--index] = end - bufferStart;
      buffer2[--index] = start - bufferStart;
      buffer2[--index] = id2;
    } else if (size == -3) {
      contextHash = id2;
    } else if (size == -4) {
      lookAhead = id2;
    }
    return index;
  }
  let children = [], positions = [];
  while (cursor.pos > 0)
    takeNode(data.start || 0, data.bufferStart || 0, children, positions, -1, 0);
  let length = (_a = data.length) !== null && _a !== void 0 ? _a : children.length ? positions[0] + children[0].length : 0;
  return new Tree(types[data.topID], children.reverse(), positions.reverse(), length);
}
var nodeSizeCache = /* @__PURE__ */ new WeakMap();
function nodeSize(balanceType, node) {
  if (!balanceType.isAnonymous || node instanceof TreeBuffer || node.type != balanceType)
    return 1;
  let size = nodeSizeCache.get(node);
  if (size == null) {
    size = 1;
    for (let child of node.children) {
      if (child.type != balanceType || !(child instanceof Tree)) {
        size = 1;
        break;
      }
      size += nodeSize(balanceType, child);
    }
    nodeSizeCache.set(node, size);
  }
  return size;
}
function balanceRange(balanceType, children, positions, from, to, start, length, mkTop, mkTree) {
  let total = 0;
  for (let i = from; i < to; i++)
    total += nodeSize(balanceType, children[i]);
  let maxChild = Math.ceil(
    total * 1.5 / 8
    /* Balance.BranchFactor */
  );
  let localChildren = [], localPositions = [];
  function divide(children2, positions2, from2, to2, offset) {
    for (let i = from2; i < to2; ) {
      let groupFrom = i, groupStart = positions2[i], groupSize = nodeSize(balanceType, children2[i]);
      i++;
      for (; i < to2; i++) {
        let nextSize = nodeSize(balanceType, children2[i]);
        if (groupSize + nextSize >= maxChild)
          break;
        groupSize += nextSize;
      }
      if (i == groupFrom + 1) {
        if (groupSize > maxChild) {
          let only = children2[groupFrom];
          divide(only.children, only.positions, 0, only.children.length, positions2[groupFrom] + offset);
          continue;
        }
        localChildren.push(children2[groupFrom]);
      } else {
        let length2 = positions2[i - 1] + children2[i - 1].length - groupStart;
        localChildren.push(balanceRange(balanceType, children2, positions2, groupFrom, i, groupStart, length2, null, mkTree));
      }
      localPositions.push(groupStart + offset - start);
    }
  }
  divide(children, positions, from, to, 0);
  return (mkTop || mkTree)(localChildren, localPositions, length);
}
var Parser = class {
  /**
  Start a parse, returning a [partial parse](#common.PartialParse)
  object. [`fragments`](#common.TreeFragment) can be passed in to
  make the parse incremental.
  
  By default, the entire input is parsed. You can pass `ranges`,
  which should be a sorted array of non-empty, non-overlapping
  ranges, to parse only those ranges. The tree returned in that
  case will start at `ranges[0].from`.
  */
  startParse(input, fragments, ranges) {
    if (typeof input == "string")
      input = new StringInput(input);
    ranges = !ranges ? [new Range(0, input.length)] : ranges.length ? ranges.map((r) => new Range(r.from, r.to)) : [new Range(0, 0)];
    return this.createParse(input, fragments || [], ranges);
  }
  /**
  Run a full parse, returning the resulting tree.
  */
  parse(input, fragments, ranges) {
    let parse = this.startParse(input, fragments, ranges);
    for (; ; ) {
      let done = parse.advance();
      if (done)
        return done;
    }
  }
};
var StringInput = class {
  constructor(string2) {
    this.string = string2;
  }
  get length() {
    return this.string.length;
  }
  chunk(from) {
    return this.string.slice(from);
  }
  get lineChunks() {
    return false;
  }
  read(from, to) {
    return this.string.slice(from, to);
  }
};
var stoppedInner = new NodeProp({ perNode: true });

// node_modules/@lezer/lr/dist/index.js
var Stack = class _Stack {
  /**
  @internal
  */
  constructor(p, stack, state, reducePos, pos, score, buffer, bufferBase, curContext, lookAhead = 0, parent) {
    this.p = p;
    this.stack = stack;
    this.state = state;
    this.reducePos = reducePos;
    this.pos = pos;
    this.score = score;
    this.buffer = buffer;
    this.bufferBase = bufferBase;
    this.curContext = curContext;
    this.lookAhead = lookAhead;
    this.parent = parent;
  }
  /**
  @internal
  */
  toString() {
    return `[${this.stack.filter((_, i) => i % 3 == 0).concat(this.state)}]@${this.pos}${this.score ? "!" + this.score : ""}`;
  }
  // Start an empty stack
  /**
  @internal
  */
  static start(p, state, pos = 0) {
    let cx = p.parser.context;
    return new _Stack(p, [], state, pos, pos, 0, [], 0, cx ? new StackContext(cx, cx.start) : null, 0, null);
  }
  /**
  The stack's current [context](#lr.ContextTracker) value, if
  any. Its type will depend on the context tracker's type
  parameter, or it will be `null` if there is no context
  tracker.
  */
  get context() {
    return this.curContext ? this.curContext.context : null;
  }
  // Push a state onto the stack, tracking its start position as well
  // as the buffer base at that point.
  /**
  @internal
  */
  pushState(state, start) {
    this.stack.push(this.state, start, this.bufferBase + this.buffer.length);
    this.state = state;
  }
  // Apply a reduce action
  /**
  @internal
  */
  reduce(action) {
    var _a;
    let depth = action >> 19, type = action & 65535;
    let { parser: parser2 } = this.p;
    let lookaheadRecord = this.reducePos < this.pos - 25 && this.setLookAhead(this.pos);
    let dPrec = parser2.dynamicPrecedence(type);
    if (dPrec)
      this.score += dPrec;
    if (depth == 0) {
      if (type < parser2.minRepeatTerm && this.reducePos < this.pos)
        this.reducePos = this.pos;
      this.pushState(parser2.getGoto(this.state, type, true), this.reducePos);
      if (type < parser2.minRepeatTerm)
        this.storeNode(type, this.reducePos, this.reducePos, lookaheadRecord ? 8 : 4, true);
      this.reduceContext(type, this.reducePos);
      return;
    }
    let base = this.stack.length - (depth - 1) * 3 - (action & 262144 ? 6 : 0);
    let start = base ? this.stack[base - 2] : this.p.ranges[0].from;
    if (type < parser2.minRepeatTerm && start == this.reducePos && this.reducePos < this.pos)
      this.reducePos = this.pos;
    let size = this.reducePos - start;
    if (size >= 2e3 && !((_a = this.p.parser.nodeSet.types[type]) === null || _a === void 0 ? void 0 : _a.isAnonymous)) {
      if (start == this.p.lastBigReductionStart) {
        this.p.bigReductionCount++;
        this.p.lastBigReductionSize = size;
      } else if (this.p.lastBigReductionSize < size) {
        this.p.bigReductionCount = 1;
        this.p.lastBigReductionStart = start;
        this.p.lastBigReductionSize = size;
      }
    }
    let bufferBase = base ? this.stack[base - 1] : 0, count = this.bufferBase + this.buffer.length - bufferBase;
    if (type < parser2.minRepeatTerm || action & 131072) {
      let pos = parser2.stateFlag(
        this.state,
        1
        /* StateFlag.Skipped */
      ) ? this.pos : this.reducePos;
      this.storeNode(type, start, pos, count + 4, true);
    }
    if (action & 262144) {
      this.state = this.stack[base];
    } else {
      let baseStateID = this.stack[base - 3];
      this.state = parser2.getGoto(baseStateID, type, true);
    }
    while (this.stack.length > base)
      this.stack.pop();
    this.reduceContext(type, start);
  }
  // Shift a value into the buffer
  /**
  @internal
  */
  storeNode(term, start, end, size = 4, mustSink = false) {
    if (term == 0 && (!this.stack.length || this.stack[this.stack.length - 1] < this.buffer.length + this.bufferBase)) {
      let top = this.buffer.length;
      if (top > 0 && this.buffer[top - 4] == 0 && this.buffer[top - 1] > -1) {
        if (start == end)
          return;
        if (this.buffer[top - 2] >= start) {
          this.buffer[top - 2] = end;
          return;
        }
      }
    }
    if (!mustSink || this.pos == end) {
      this.buffer.push(term, start, end, size);
    } else {
      let index = this.buffer.length;
      if (index > 0 && (this.buffer[index - 4] != 0 || this.buffer[index - 1] < 0)) {
        let mustMove = false;
        for (let scan = index; scan > 0 && this.buffer[scan - 2] > end; scan -= 4) {
          if (this.buffer[scan - 1] >= 0) {
            mustMove = true;
            break;
          }
        }
        if (mustMove)
          while (index > 0 && this.buffer[index - 2] > end) {
            this.buffer[index] = this.buffer[index - 4];
            this.buffer[index + 1] = this.buffer[index - 3];
            this.buffer[index + 2] = this.buffer[index - 2];
            this.buffer[index + 3] = this.buffer[index - 1];
            index -= 4;
            if (size > 4)
              size -= 4;
          }
      }
      this.buffer[index] = term;
      this.buffer[index + 1] = start;
      this.buffer[index + 2] = end;
      this.buffer[index + 3] = size;
    }
  }
  // Apply a shift action
  /**
  @internal
  */
  shift(action, type, start, end) {
    if (action & 131072) {
      this.pushState(action & 65535, this.pos);
    } else if ((action & 262144) == 0) {
      let nextState = action, { parser: parser2 } = this.p;
      this.pos = end;
      let skipped = parser2.stateFlag(
        nextState,
        1
        /* StateFlag.Skipped */
      );
      if (!skipped && (end > start || type <= parser2.maxNode))
        this.reducePos = end;
      this.pushState(nextState, skipped ? start : Math.min(start, this.reducePos));
      this.shiftContext(type, start);
      if (type <= parser2.maxNode)
        this.buffer.push(type, start, end, 4);
    } else {
      this.pos = end;
      this.shiftContext(type, start);
      if (type <= this.p.parser.maxNode)
        this.buffer.push(type, start, end, 4);
    }
  }
  // Apply an action
  /**
  @internal
  */
  apply(action, next, nextStart, nextEnd) {
    if (action & 65536)
      this.reduce(action);
    else
      this.shift(action, next, nextStart, nextEnd);
  }
  // Add a prebuilt (reused) node into the buffer.
  /**
  @internal
  */
  useNode(value, next) {
    let index = this.p.reused.length - 1;
    if (index < 0 || this.p.reused[index] != value) {
      this.p.reused.push(value);
      index++;
    }
    let start = this.pos;
    this.reducePos = this.pos = start + value.length;
    this.pushState(next, start);
    this.buffer.push(
      index,
      start,
      this.reducePos,
      -1
      /* size == -1 means this is a reused value */
    );
    if (this.curContext)
      this.updateContext(this.curContext.tracker.reuse(this.curContext.context, value, this, this.p.stream.reset(this.pos - value.length)));
  }
  // Split the stack. Due to the buffer sharing and the fact
  // that `this.stack` tends to stay quite shallow, this isn't very
  // expensive.
  /**
  @internal
  */
  split() {
    let parent = this;
    let off = parent.buffer.length;
    if (off && parent.buffer[off - 4] == 0)
      off -= 4;
    while (off > 0 && parent.buffer[off - 2] > parent.reducePos)
      off -= 4;
    let buffer = parent.buffer.slice(off), base = parent.bufferBase + off;
    while (parent && base == parent.bufferBase)
      parent = parent.parent;
    return new _Stack(this.p, this.stack.slice(), this.state, this.reducePos, this.pos, this.score, buffer, base, this.curContext, this.lookAhead, parent);
  }
  // Try to recover from an error by 'deleting' (ignoring) one token.
  /**
  @internal
  */
  recoverByDelete(next, nextEnd) {
    let isNode = next <= this.p.parser.maxNode;
    if (isNode)
      this.storeNode(next, this.pos, nextEnd, 4);
    this.storeNode(0, this.pos, nextEnd, isNode ? 8 : 4);
    this.pos = this.reducePos = nextEnd;
    this.score -= 190;
  }
  /**
  Check if the given term would be able to be shifted (optionally
  after some reductions) on this stack. This can be useful for
  external tokenizers that want to make sure they only provide a
  given token when it applies.
  */
  canShift(term) {
    for (let sim = new SimulatedStack(this); ; ) {
      let action = this.p.parser.stateSlot(
        sim.state,
        4
        /* ParseState.DefaultReduce */
      ) || this.p.parser.hasAction(sim.state, term);
      if (action == 0)
        return false;
      if ((action & 65536) == 0)
        return true;
      sim.reduce(action);
    }
  }
  // Apply up to Recover.MaxNext recovery actions that conceptually
  // inserts some missing token or rule.
  /**
  @internal
  */
  recoverByInsert(next) {
    if (this.stack.length >= 300)
      return [];
    let nextStates = this.p.parser.nextStates(this.state);
    if (nextStates.length > 4 << 1 || this.stack.length >= 120) {
      let best = [];
      for (let i = 0, s; i < nextStates.length; i += 2) {
        if ((s = nextStates[i + 1]) != this.state && this.p.parser.hasAction(s, next))
          best.push(nextStates[i], s);
      }
      if (this.stack.length < 120)
        for (let i = 0; best.length < 4 << 1 && i < nextStates.length; i += 2) {
          let s = nextStates[i + 1];
          if (!best.some((v, i2) => i2 & 1 && v == s))
            best.push(nextStates[i], s);
        }
      nextStates = best;
    }
    let result = [];
    for (let i = 0; i < nextStates.length && result.length < 4; i += 2) {
      let s = nextStates[i + 1];
      if (s == this.state)
        continue;
      let stack = this.split();
      stack.pushState(s, this.pos);
      stack.storeNode(0, stack.pos, stack.pos, 4, true);
      stack.shiftContext(nextStates[i], this.pos);
      stack.reducePos = this.pos;
      stack.score -= 200;
      result.push(stack);
    }
    return result;
  }
  // Force a reduce, if possible. Return false if that can't
  // be done.
  /**
  @internal
  */
  forceReduce() {
    let { parser: parser2 } = this.p;
    let reduce = parser2.stateSlot(
      this.state,
      5
      /* ParseState.ForcedReduce */
    );
    if ((reduce & 65536) == 0)
      return false;
    if (!parser2.validAction(this.state, reduce)) {
      let depth = reduce >> 19, term = reduce & 65535;
      let target = this.stack.length - depth * 3;
      if (target < 0 || parser2.getGoto(this.stack[target], term, false) < 0) {
        let backup = this.findForcedReduction();
        if (backup == null)
          return false;
        reduce = backup;
      }
      this.storeNode(0, this.pos, this.pos, 4, true);
      this.score -= 100;
    }
    this.reducePos = this.pos;
    this.reduce(reduce);
    return true;
  }
  /**
  Try to scan through the automaton to find some kind of reduction
  that can be applied. Used when the regular ForcedReduce field
  isn't a valid action. @internal
  */
  findForcedReduction() {
    let { parser: parser2 } = this.p, seen = [];
    let explore = (state, depth) => {
      if (seen.includes(state))
        return;
      seen.push(state);
      return parser2.allActions(state, (action) => {
        if (action & (262144 | 131072)) ;
        else if (action & 65536) {
          let rDepth = (action >> 19) - depth;
          if (rDepth > 1) {
            let term = action & 65535, target = this.stack.length - rDepth * 3;
            if (target >= 0 && parser2.getGoto(this.stack[target], term, false) >= 0)
              return rDepth << 19 | 65536 | term;
          }
        } else {
          let found = explore(action, depth + 1);
          if (found != null)
            return found;
        }
      });
    };
    return explore(this.state, 0);
  }
  /**
  @internal
  */
  forceAll() {
    while (!this.p.parser.stateFlag(
      this.state,
      2
      /* StateFlag.Accepting */
    )) {
      if (!this.forceReduce()) {
        this.storeNode(0, this.pos, this.pos, 4, true);
        break;
      }
    }
    return this;
  }
  /**
  Check whether this state has no further actions (assumed to be a direct descendant of the
  top state, since any other states must be able to continue
  somehow). @internal
  */
  get deadEnd() {
    if (this.stack.length != 3)
      return false;
    let { parser: parser2 } = this.p;
    return parser2.data[parser2.stateSlot(
      this.state,
      1
      /* ParseState.Actions */
    )] == 65535 && !parser2.stateSlot(
      this.state,
      4
      /* ParseState.DefaultReduce */
    );
  }
  /**
  Restart the stack (put it back in its start state). Only safe
  when this.stack.length == 3 (state is directly below the top
  state). @internal
  */
  restart() {
    this.storeNode(0, this.pos, this.pos, 4, true);
    this.state = this.stack[0];
    this.stack.length = 0;
  }
  /**
  @internal
  */
  sameState(other) {
    if (this.state != other.state || this.stack.length != other.stack.length)
      return false;
    for (let i = 0; i < this.stack.length; i += 3)
      if (this.stack[i] != other.stack[i])
        return false;
    return true;
  }
  /**
  Get the parser used by this stack.
  */
  get parser() {
    return this.p.parser;
  }
  /**
  Test whether a given dialect (by numeric ID, as exported from
  the terms file) is enabled.
  */
  dialectEnabled(dialectID) {
    return this.p.parser.dialect.flags[dialectID];
  }
  shiftContext(term, start) {
    if (this.curContext)
      this.updateContext(this.curContext.tracker.shift(this.curContext.context, term, this, this.p.stream.reset(start)));
  }
  reduceContext(term, start) {
    if (this.curContext)
      this.updateContext(this.curContext.tracker.reduce(this.curContext.context, term, this, this.p.stream.reset(start)));
  }
  /**
  @internal
  */
  emitContext() {
    let last = this.buffer.length - 1;
    if (last < 0 || this.buffer[last] != -3)
      this.buffer.push(this.curContext.hash, this.pos, this.pos, -3);
  }
  /**
  @internal
  */
  emitLookAhead() {
    let last = this.buffer.length - 1;
    if (last < 0 || this.buffer[last] != -4)
      this.buffer.push(this.lookAhead, this.pos, this.pos, -4);
  }
  updateContext(context) {
    if (context != this.curContext.context) {
      let newCx = new StackContext(this.curContext.tracker, context);
      if (newCx.hash != this.curContext.hash)
        this.emitContext();
      this.curContext = newCx;
    }
  }
  /**
  @internal
  */
  setLookAhead(lookAhead) {
    if (lookAhead <= this.lookAhead)
      return false;
    this.emitLookAhead();
    this.lookAhead = lookAhead;
    return true;
  }
  /**
  @internal
  */
  close() {
    if (this.curContext && this.curContext.tracker.strict)
      this.emitContext();
    if (this.lookAhead > 0)
      this.emitLookAhead();
  }
};
var StackContext = class {
  constructor(tracker, context) {
    this.tracker = tracker;
    this.context = context;
    this.hash = tracker.strict ? tracker.hash(context) : 0;
  }
};
var SimulatedStack = class {
  constructor(start) {
    this.start = start;
    this.state = start.state;
    this.stack = start.stack;
    this.base = this.stack.length;
  }
  reduce(action) {
    let term = action & 65535, depth = action >> 19;
    if (depth == 0) {
      if (this.stack == this.start.stack)
        this.stack = this.stack.slice();
      this.stack.push(this.state, 0, 0);
      this.base += 3;
    } else {
      this.base -= (depth - 1) * 3;
    }
    let goto = this.start.p.parser.getGoto(this.stack[this.base - 3], term, true);
    this.state = goto;
  }
};
var StackBufferCursor = class _StackBufferCursor {
  constructor(stack, pos, index) {
    this.stack = stack;
    this.pos = pos;
    this.index = index;
    this.buffer = stack.buffer;
    if (this.index == 0)
      this.maybeNext();
  }
  static create(stack, pos = stack.bufferBase + stack.buffer.length) {
    return new _StackBufferCursor(stack, pos, pos - stack.bufferBase);
  }
  maybeNext() {
    let next = this.stack.parent;
    if (next != null) {
      this.index = this.stack.bufferBase - next.bufferBase;
      this.stack = next;
      this.buffer = next.buffer;
    }
  }
  get id() {
    return this.buffer[this.index - 4];
  }
  get start() {
    return this.buffer[this.index - 3];
  }
  get end() {
    return this.buffer[this.index - 2];
  }
  get size() {
    return this.buffer[this.index - 1];
  }
  next() {
    this.index -= 4;
    this.pos -= 4;
    if (this.index == 0)
      this.maybeNext();
  }
  fork() {
    return new _StackBufferCursor(this.stack, this.pos, this.index);
  }
};
function decodeArray(input, Type = Uint16Array) {
  if (typeof input != "string")
    return input;
  let array = null;
  for (let pos = 0, out = 0; pos < input.length; ) {
    let value = 0;
    for (; ; ) {
      let next = input.charCodeAt(pos++), stop = false;
      if (next == 126) {
        value = 65535;
        break;
      }
      if (next >= 92)
        next--;
      if (next >= 34)
        next--;
      let digit = next - 32;
      if (digit >= 46) {
        digit -= 46;
        stop = true;
      }
      value += digit;
      if (stop)
        break;
      value *= 46;
    }
    if (array)
      array[out++] = value;
    else
      array = new Type(value);
  }
  return array;
}
var CachedToken = class {
  constructor() {
    this.start = -1;
    this.value = -1;
    this.end = -1;
    this.extended = -1;
    this.lookAhead = 0;
    this.mask = 0;
    this.context = 0;
  }
};
var nullToken = new CachedToken();
var InputStream = class {
  /**
  @internal
  */
  constructor(input, ranges) {
    this.input = input;
    this.ranges = ranges;
    this.chunk = "";
    this.chunkOff = 0;
    this.chunk2 = "";
    this.chunk2Pos = 0;
    this.next = -1;
    this.token = nullToken;
    this.rangeIndex = 0;
    this.pos = this.chunkPos = ranges[0].from;
    this.range = ranges[0];
    this.end = ranges[ranges.length - 1].to;
    this.readNext();
  }
  /**
  @internal
  */
  resolveOffset(offset, assoc) {
    let range = this.range, index = this.rangeIndex;
    let pos = this.pos + offset;
    while (pos < range.from) {
      if (!index)
        return null;
      let next = this.ranges[--index];
      pos -= range.from - next.to;
      range = next;
    }
    while (assoc < 0 ? pos > range.to : pos >= range.to) {
      if (index == this.ranges.length - 1)
        return null;
      let next = this.ranges[++index];
      pos += next.from - range.to;
      range = next;
    }
    return pos;
  }
  /**
  @internal
  */
  clipPos(pos) {
    if (pos >= this.range.from && pos < this.range.to)
      return pos;
    for (let range of this.ranges)
      if (range.to > pos)
        return Math.max(pos, range.from);
    return this.end;
  }
  /**
  Look at a code unit near the stream position. `.peek(0)` equals
  `.next`, `.peek(-1)` gives you the previous character, and so
  on.
  
  Note that looking around during tokenizing creates dependencies
  on potentially far-away content, which may reduce the
  effectiveness incremental parsing—when looking forward—or even
  cause invalid reparses when looking backward more than 25 code
  units, since the library does not track lookbehind.
  */
  peek(offset) {
    let idx = this.chunkOff + offset, pos, result;
    if (idx >= 0 && idx < this.chunk.length) {
      pos = this.pos + offset;
      result = this.chunk.charCodeAt(idx);
    } else {
      let resolved = this.resolveOffset(offset, 1);
      if (resolved == null)
        return -1;
      pos = resolved;
      if (pos >= this.chunk2Pos && pos < this.chunk2Pos + this.chunk2.length) {
        result = this.chunk2.charCodeAt(pos - this.chunk2Pos);
      } else {
        let i = this.rangeIndex, range = this.range;
        while (range.to <= pos)
          range = this.ranges[++i];
        this.chunk2 = this.input.chunk(this.chunk2Pos = pos);
        if (pos + this.chunk2.length > range.to)
          this.chunk2 = this.chunk2.slice(0, range.to - pos);
        result = this.chunk2.charCodeAt(0);
      }
    }
    if (pos >= this.token.lookAhead)
      this.token.lookAhead = pos + 1;
    return result;
  }
  /**
  Accept a token. By default, the end of the token is set to the
  current stream position, but you can pass an offset (relative to
  the stream position) to change that.
  */
  acceptToken(token, endOffset = 0) {
    let end = endOffset ? this.resolveOffset(endOffset, -1) : this.pos;
    if (end == null || end < this.token.start)
      throw new RangeError("Token end out of bounds");
    this.token.value = token;
    this.token.end = end;
  }
  /**
  Accept a token ending at a specific given position.
  */
  acceptTokenTo(token, endPos) {
    this.token.value = token;
    this.token.end = endPos;
  }
  getChunk() {
    if (this.pos >= this.chunk2Pos && this.pos < this.chunk2Pos + this.chunk2.length) {
      let { chunk, chunkPos } = this;
      this.chunk = this.chunk2;
      this.chunkPos = this.chunk2Pos;
      this.chunk2 = chunk;
      this.chunk2Pos = chunkPos;
      this.chunkOff = this.pos - this.chunkPos;
    } else {
      this.chunk2 = this.chunk;
      this.chunk2Pos = this.chunkPos;
      let nextChunk = this.input.chunk(this.pos);
      let end = this.pos + nextChunk.length;
      this.chunk = end > this.range.to ? nextChunk.slice(0, this.range.to - this.pos) : nextChunk;
      this.chunkPos = this.pos;
      this.chunkOff = 0;
    }
  }
  readNext() {
    if (this.chunkOff >= this.chunk.length) {
      this.getChunk();
      if (this.chunkOff == this.chunk.length)
        return this.next = -1;
    }
    return this.next = this.chunk.charCodeAt(this.chunkOff);
  }
  /**
  Move the stream forward N (defaults to 1) code units. Returns
  the new value of [`next`](#lr.InputStream.next).
  */
  advance(n = 1) {
    this.chunkOff += n;
    while (this.pos + n >= this.range.to) {
      if (this.rangeIndex == this.ranges.length - 1)
        return this.setDone();
      n -= this.range.to - this.pos;
      this.range = this.ranges[++this.rangeIndex];
      this.pos = this.range.from;
    }
    this.pos += n;
    if (this.pos >= this.token.lookAhead)
      this.token.lookAhead = this.pos + 1;
    return this.readNext();
  }
  setDone() {
    this.pos = this.chunkPos = this.end;
    this.range = this.ranges[this.rangeIndex = this.ranges.length - 1];
    this.chunk = "";
    return this.next = -1;
  }
  /**
  @internal
  */
  reset(pos, token) {
    if (token) {
      this.token = token;
      token.start = pos;
      token.lookAhead = pos + 1;
      token.value = token.extended = -1;
    } else {
      this.token = nullToken;
    }
    if (this.pos != pos) {
      this.pos = pos;
      if (pos == this.end) {
        this.setDone();
        return this;
      }
      while (pos < this.range.from)
        this.range = this.ranges[--this.rangeIndex];
      while (pos >= this.range.to)
        this.range = this.ranges[++this.rangeIndex];
      if (pos >= this.chunkPos && pos < this.chunkPos + this.chunk.length) {
        this.chunkOff = pos - this.chunkPos;
      } else {
        this.chunk = "";
        this.chunkOff = 0;
      }
      this.readNext();
    }
    return this;
  }
  /**
  @internal
  */
  read(from, to) {
    if (from >= this.chunkPos && to <= this.chunkPos + this.chunk.length)
      return this.chunk.slice(from - this.chunkPos, to - this.chunkPos);
    if (from >= this.chunk2Pos && to <= this.chunk2Pos + this.chunk2.length)
      return this.chunk2.slice(from - this.chunk2Pos, to - this.chunk2Pos);
    if (from >= this.range.from && to <= this.range.to)
      return this.input.read(from, to);
    let result = "";
    for (let r of this.ranges) {
      if (r.from >= to)
        break;
      if (r.to > from)
        result += this.input.read(Math.max(r.from, from), Math.min(r.to, to));
    }
    return result;
  }
};
var TokenGroup = class {
  constructor(data, id2) {
    this.data = data;
    this.id = id2;
  }
  token(input, stack) {
    let { parser: parser2 } = stack.p;
    readToken(this.data, input, stack, this.id, parser2.data, parser2.tokenPrecTable);
  }
};
TokenGroup.prototype.contextual = TokenGroup.prototype.fallback = TokenGroup.prototype.extend = false;
var LocalTokenGroup = class {
  constructor(data, precTable, elseToken) {
    this.precTable = precTable;
    this.elseToken = elseToken;
    this.data = typeof data == "string" ? decodeArray(data) : data;
  }
  token(input, stack) {
    let start = input.pos, skipped = 0;
    for (; ; ) {
      let atEof = input.next < 0, nextPos = input.resolveOffset(1, 1);
      readToken(this.data, input, stack, 0, this.data, this.precTable);
      if (input.token.value > -1)
        break;
      if (this.elseToken == null)
        return;
      if (!atEof)
        skipped++;
      if (nextPos == null)
        break;
      input.reset(nextPos, input.token);
    }
    if (skipped) {
      input.reset(start, input.token);
      input.acceptToken(this.elseToken, skipped);
    }
  }
};
LocalTokenGroup.prototype.contextual = TokenGroup.prototype.fallback = TokenGroup.prototype.extend = false;
var ExternalTokenizer = class {
  /**
  Create a tokenizer. The first argument is the function that,
  given an input stream, scans for the types of tokens it
  recognizes at the stream's position, and calls
  [`acceptToken`](#lr.InputStream.acceptToken) when it finds
  one.
  */
  constructor(token, options = {}) {
    this.token = token;
    this.contextual = !!options.contextual;
    this.fallback = !!options.fallback;
    this.extend = !!options.extend;
  }
};
function readToken(data, input, stack, group, precTable, precOffset) {
  let state = 0, groupMask = 1 << group, { dialect } = stack.p.parser;
  scan: for (; ; ) {
    if ((groupMask & data[state]) == 0)
      break;
    let accEnd = data[state + 1];
    for (let i = state + 3; i < accEnd; i += 2)
      if ((data[i + 1] & groupMask) > 0) {
        let term = data[i];
        if (dialect.allows(term) && (input.token.value == -1 || input.token.value == term || overrides(term, input.token.value, precTable, precOffset))) {
          input.acceptToken(term);
          break;
        }
      }
    let next = input.next, low = 0, high = data[state + 2];
    if (input.next < 0 && high > low && data[accEnd + high * 3 - 3] == 65535) {
      state = data[accEnd + high * 3 - 1];
      continue scan;
    }
    for (; low < high; ) {
      let mid = low + high >> 1;
      let index = accEnd + mid + (mid << 1);
      let from = data[index], to = data[index + 1] || 65536;
      if (next < from)
        high = mid;
      else if (next >= to)
        low = mid + 1;
      else {
        state = data[index + 2];
        input.advance();
        continue scan;
      }
    }
    break;
  }
}
function findOffset(data, start, term) {
  for (let i = start, next; (next = data[i]) != 65535; i++)
    if (next == term)
      return i - start;
  return -1;
}
function overrides(token, prev, tableData, tableOffset) {
  let iPrev = findOffset(tableData, tableOffset, prev);
  return iPrev < 0 || findOffset(tableData, tableOffset, token) < iPrev;
}
var verbose = typeof process != "undefined" && process.env && /\bparse\b/.test(process.env.LOG);
var stackIDs = null;
function cutAt(tree, pos, side) {
  let cursor = tree.cursor(IterMode.IncludeAnonymous);
  cursor.moveTo(pos);
  for (; ; ) {
    if (!(side < 0 ? cursor.childBefore(pos) : cursor.childAfter(pos)))
      for (; ; ) {
        if ((side < 0 ? cursor.to < pos : cursor.from > pos) && !cursor.type.isError)
          return side < 0 ? Math.max(0, Math.min(
            cursor.to - 1,
            pos - 25
            /* Lookahead.Margin */
          )) : Math.min(tree.length, Math.max(
            cursor.from + 1,
            pos + 25
            /* Lookahead.Margin */
          ));
        if (side < 0 ? cursor.prevSibling() : cursor.nextSibling())
          break;
        if (!cursor.parent())
          return side < 0 ? 0 : tree.length;
      }
  }
}
var FragmentCursor = class {
  constructor(fragments, nodeSet) {
    this.fragments = fragments;
    this.nodeSet = nodeSet;
    this.i = 0;
    this.fragment = null;
    this.safeFrom = -1;
    this.safeTo = -1;
    this.trees = [];
    this.start = [];
    this.index = [];
    this.nextFragment();
  }
  nextFragment() {
    let fr = this.fragment = this.i == this.fragments.length ? null : this.fragments[this.i++];
    if (fr) {
      this.safeFrom = fr.openStart ? cutAt(fr.tree, fr.from + fr.offset, 1) - fr.offset : fr.from;
      this.safeTo = fr.openEnd ? cutAt(fr.tree, fr.to + fr.offset, -1) - fr.offset : fr.to;
      while (this.trees.length) {
        this.trees.pop();
        this.start.pop();
        this.index.pop();
      }
      this.trees.push(fr.tree);
      this.start.push(-fr.offset);
      this.index.push(0);
      this.nextStart = this.safeFrom;
    } else {
      this.nextStart = 1e9;
    }
  }
  // `pos` must be >= any previously given `pos` for this cursor
  nodeAt(pos) {
    if (pos < this.nextStart)
      return null;
    while (this.fragment && this.safeTo <= pos)
      this.nextFragment();
    if (!this.fragment)
      return null;
    for (; ; ) {
      let last = this.trees.length - 1;
      if (last < 0) {
        this.nextFragment();
        return null;
      }
      let top = this.trees[last], index = this.index[last];
      if (index == top.children.length) {
        this.trees.pop();
        this.start.pop();
        this.index.pop();
        continue;
      }
      let next = top.children[index];
      let start = this.start[last] + top.positions[index];
      if (start > pos) {
        this.nextStart = start;
        return null;
      }
      if (next instanceof Tree) {
        if (start == pos) {
          if (start < this.safeFrom)
            return null;
          let end = start + next.length;
          if (end <= this.safeTo) {
            let lookAhead = next.prop(NodeProp.lookAhead);
            if (!lookAhead || end + lookAhead < this.fragment.to)
              return next;
          }
        }
        this.index[last]++;
        if (start + next.length >= Math.max(this.safeFrom, pos)) {
          this.trees.push(next);
          this.start.push(start);
          this.index.push(0);
        }
      } else {
        this.index[last]++;
        this.nextStart = start + next.length;
      }
    }
  }
};
var TokenCache = class {
  constructor(parser2, stream) {
    this.stream = stream;
    this.tokens = [];
    this.mainToken = null;
    this.actions = [];
    this.tokens = parser2.tokenizers.map((_) => new CachedToken());
  }
  getActions(stack) {
    let actionIndex = 0;
    let main = null;
    let { parser: parser2 } = stack.p, { tokenizers } = parser2;
    let mask = parser2.stateSlot(
      stack.state,
      3
      /* ParseState.TokenizerMask */
    );
    let context = stack.curContext ? stack.curContext.hash : 0;
    let lookAhead = 0;
    for (let i = 0; i < tokenizers.length; i++) {
      if ((1 << i & mask) == 0)
        continue;
      let tokenizer = tokenizers[i], token = this.tokens[i];
      if (main && !tokenizer.fallback)
        continue;
      if (tokenizer.contextual || token.start != stack.pos || token.mask != mask || token.context != context) {
        this.updateCachedToken(token, tokenizer, stack);
        token.mask = mask;
        token.context = context;
      }
      if (token.lookAhead > token.end + 25)
        lookAhead = Math.max(token.lookAhead, lookAhead);
      if (token.value != 0) {
        let startIndex = actionIndex;
        if (token.extended > -1)
          actionIndex = this.addActions(stack, token.extended, token.end, actionIndex);
        actionIndex = this.addActions(stack, token.value, token.end, actionIndex);
        if (!tokenizer.extend) {
          main = token;
          if (actionIndex > startIndex)
            break;
        }
      }
    }
    while (this.actions.length > actionIndex)
      this.actions.pop();
    if (lookAhead)
      stack.setLookAhead(lookAhead);
    if (!main && stack.pos == this.stream.end) {
      main = new CachedToken();
      main.value = stack.p.parser.eofTerm;
      main.start = main.end = stack.pos;
      actionIndex = this.addActions(stack, main.value, main.end, actionIndex);
    }
    this.mainToken = main;
    return this.actions;
  }
  getMainToken(stack) {
    if (this.mainToken)
      return this.mainToken;
    let main = new CachedToken(), { pos, p } = stack;
    main.start = pos;
    main.end = Math.min(pos + 1, p.stream.end);
    main.value = pos == p.stream.end ? p.parser.eofTerm : 0;
    return main;
  }
  updateCachedToken(token, tokenizer, stack) {
    let start = this.stream.clipPos(stack.pos);
    tokenizer.token(this.stream.reset(start, token), stack);
    if (token.value > -1) {
      let { parser: parser2 } = stack.p;
      for (let i = 0; i < parser2.specialized.length; i++)
        if (parser2.specialized[i] == token.value) {
          let result = parser2.specializers[i](this.stream.read(token.start, token.end), stack);
          if (result >= 0 && stack.p.parser.dialect.allows(result >> 1)) {
            if ((result & 1) == 0)
              token.value = result >> 1;
            else
              token.extended = result >> 1;
            break;
          }
        }
    } else {
      token.value = 0;
      token.end = this.stream.clipPos(start + 1);
    }
  }
  putAction(action, token, end, index) {
    for (let i = 0; i < index; i += 3)
      if (this.actions[i] == action)
        return index;
    this.actions[index++] = action;
    this.actions[index++] = token;
    this.actions[index++] = end;
    return index;
  }
  addActions(stack, token, end, index) {
    let { state } = stack, { parser: parser2 } = stack.p, { data } = parser2;
    for (let set = 0; set < 2; set++) {
      for (let i = parser2.stateSlot(
        state,
        set ? 2 : 1
        /* ParseState.Actions */
      ); ; i += 3) {
        if (data[i] == 65535) {
          if (data[i + 1] == 1) {
            i = pair(data, i + 2);
          } else {
            if (index == 0 && data[i + 1] == 2)
              index = this.putAction(pair(data, i + 2), token, end, index);
            break;
          }
        }
        if (data[i] == token)
          index = this.putAction(pair(data, i + 1), token, end, index);
      }
    }
    return index;
  }
};
var Parse = class {
  constructor(parser2, input, fragments, ranges) {
    this.parser = parser2;
    this.input = input;
    this.ranges = ranges;
    this.recovering = 0;
    this.nextStackID = 9812;
    this.minStackPos = 0;
    this.reused = [];
    this.stoppedAt = null;
    this.lastBigReductionStart = -1;
    this.lastBigReductionSize = 0;
    this.bigReductionCount = 0;
    this.stream = new InputStream(input, ranges);
    this.tokens = new TokenCache(parser2, this.stream);
    this.topTerm = parser2.top[1];
    let { from } = ranges[0];
    this.stacks = [Stack.start(this, parser2.top[0], from)];
    this.fragments = fragments.length && this.stream.end - from > parser2.bufferLength * 4 ? new FragmentCursor(fragments, parser2.nodeSet) : null;
  }
  get parsedPos() {
    return this.minStackPos;
  }
  // Move the parser forward. This will process all parse stacks at
  // `this.pos` and try to advance them to a further position. If no
  // stack for such a position is found, it'll start error-recovery.
  //
  // When the parse is finished, this will return a syntax tree. When
  // not, it returns `null`.
  advance() {
    let stacks = this.stacks, pos = this.minStackPos;
    let newStacks = this.stacks = [];
    let stopped, stoppedTokens;
    if (this.bigReductionCount > 300 && stacks.length == 1) {
      let [s] = stacks;
      while (s.forceReduce() && s.stack.length && s.stack[s.stack.length - 2] >= this.lastBigReductionStart) {
      }
      this.bigReductionCount = this.lastBigReductionSize = 0;
    }
    for (let i = 0; i < stacks.length; i++) {
      let stack = stacks[i];
      for (; ; ) {
        this.tokens.mainToken = null;
        if (stack.pos > pos) {
          newStacks.push(stack);
        } else if (this.advanceStack(stack, newStacks, stacks)) {
          continue;
        } else {
          if (!stopped) {
            stopped = [];
            stoppedTokens = [];
          }
          stopped.push(stack);
          let tok = this.tokens.getMainToken(stack);
          stoppedTokens.push(tok.value, tok.end);
        }
        break;
      }
    }
    if (!newStacks.length) {
      let finished = stopped && findFinished(stopped);
      if (finished) {
        if (verbose)
          console.log("Finish with " + this.stackID(finished));
        return this.stackToTree(finished);
      }
      if (this.parser.strict) {
        if (verbose && stopped)
          console.log("Stuck with token " + (this.tokens.mainToken ? this.parser.getName(this.tokens.mainToken.value) : "none"));
        throw new SyntaxError("No parse at " + pos);
      }
      if (!this.recovering)
        this.recovering = 5;
    }
    if (this.recovering && stopped) {
      let finished = this.stoppedAt != null && stopped[0].pos > this.stoppedAt ? stopped[0] : this.runRecovery(stopped, stoppedTokens, newStacks);
      if (finished) {
        if (verbose)
          console.log("Force-finish " + this.stackID(finished));
        return this.stackToTree(finished.forceAll());
      }
    }
    if (this.recovering) {
      let maxRemaining = this.recovering == 1 ? 1 : this.recovering * 3;
      if (newStacks.length > maxRemaining) {
        newStacks.sort((a, b) => b.score - a.score);
        while (newStacks.length > maxRemaining)
          newStacks.pop();
      }
      if (newStacks.some((s) => s.reducePos > pos))
        this.recovering--;
    } else if (newStacks.length > 1) {
      outer: for (let i = 0; i < newStacks.length - 1; i++) {
        let stack = newStacks[i];
        for (let j = i + 1; j < newStacks.length; j++) {
          let other = newStacks[j];
          if (stack.sameState(other) || stack.buffer.length > 500 && other.buffer.length > 500) {
            if ((stack.score - other.score || stack.buffer.length - other.buffer.length) > 0) {
              newStacks.splice(j--, 1);
            } else {
              newStacks.splice(i--, 1);
              continue outer;
            }
          }
        }
      }
      if (newStacks.length > 12) {
        newStacks.sort((a, b) => b.score - a.score);
        newStacks.splice(
          12,
          newStacks.length - 12
          /* Rec.MaxStackCount */
        );
      }
    }
    this.minStackPos = newStacks[0].pos;
    for (let i = 1; i < newStacks.length; i++)
      if (newStacks[i].pos < this.minStackPos)
        this.minStackPos = newStacks[i].pos;
    return null;
  }
  stopAt(pos) {
    if (this.stoppedAt != null && this.stoppedAt < pos)
      throw new RangeError("Can't move stoppedAt forward");
    this.stoppedAt = pos;
  }
  // Returns an updated version of the given stack, or null if the
  // stack can't advance normally. When `split` and `stacks` are
  // given, stacks split off by ambiguous operations will be pushed to
  // `split`, or added to `stacks` if they move `pos` forward.
  advanceStack(stack, stacks, split) {
    let start = stack.pos, { parser: parser2 } = this;
    let base = verbose ? this.stackID(stack) + " -> " : "";
    if (this.stoppedAt != null && start > this.stoppedAt)
      return stack.forceReduce() ? stack : null;
    if (this.fragments) {
      let strictCx = stack.curContext && stack.curContext.tracker.strict, cxHash = strictCx ? stack.curContext.hash : 0;
      for (let cached = this.fragments.nodeAt(start); cached; ) {
        let match = this.parser.nodeSet.types[cached.type.id] == cached.type ? parser2.getGoto(stack.state, cached.type.id) : -1;
        if (match > -1 && cached.length && (!strictCx || (cached.prop(NodeProp.contextHash) || 0) == cxHash)) {
          stack.useNode(cached, match);
          if (verbose)
            console.log(base + this.stackID(stack) + ` (via reuse of ${parser2.getName(cached.type.id)})`);
          return true;
        }
        if (!(cached instanceof Tree) || cached.children.length == 0 || cached.positions[0] > 0)
          break;
        let inner = cached.children[0];
        if (inner instanceof Tree && cached.positions[0] == 0)
          cached = inner;
        else
          break;
      }
    }
    let defaultReduce = parser2.stateSlot(
      stack.state,
      4
      /* ParseState.DefaultReduce */
    );
    if (defaultReduce > 0) {
      stack.reduce(defaultReduce);
      if (verbose)
        console.log(base + this.stackID(stack) + ` (via always-reduce ${parser2.getName(
          defaultReduce & 65535
          /* Action.ValueMask */
        )})`);
      return true;
    }
    if (stack.stack.length >= 8400) {
      while (stack.stack.length > 6e3 && stack.forceReduce()) {
      }
    }
    let actions = this.tokens.getActions(stack);
    for (let i = 0; i < actions.length; ) {
      let action = actions[i++], term = actions[i++], end = actions[i++];
      let last = i == actions.length || !split;
      let localStack = last ? stack : stack.split();
      let main = this.tokens.mainToken;
      localStack.apply(action, term, main ? main.start : localStack.pos, end);
      if (verbose)
        console.log(base + this.stackID(localStack) + ` (via ${(action & 65536) == 0 ? "shift" : `reduce of ${parser2.getName(
          action & 65535
          /* Action.ValueMask */
        )}`} for ${parser2.getName(term)} @ ${start}${localStack == stack ? "" : ", split"})`);
      if (last)
        return true;
      else if (localStack.pos > start)
        stacks.push(localStack);
      else
        split.push(localStack);
    }
    return false;
  }
  // Advance a given stack forward as far as it will go. Returns the
  // (possibly updated) stack if it got stuck, or null if it moved
  // forward and was given to `pushStackDedup`.
  advanceFully(stack, newStacks) {
    let pos = stack.pos;
    for (; ; ) {
      if (!this.advanceStack(stack, null, null))
        return false;
      if (stack.pos > pos) {
        pushStackDedup(stack, newStacks);
        return true;
      }
    }
  }
  runRecovery(stacks, tokens, newStacks) {
    let finished = null, restarted = false;
    for (let i = 0; i < stacks.length; i++) {
      let stack = stacks[i], token = tokens[i << 1], tokenEnd = tokens[(i << 1) + 1];
      let base = verbose ? this.stackID(stack) + " -> " : "";
      if (stack.deadEnd) {
        if (restarted)
          continue;
        restarted = true;
        stack.restart();
        if (verbose)
          console.log(base + this.stackID(stack) + " (restarted)");
        let done = this.advanceFully(stack, newStacks);
        if (done)
          continue;
      }
      let force = stack.split(), forceBase = base;
      for (let j = 0; j < 10 && force.forceReduce(); j++) {
        if (verbose)
          console.log(forceBase + this.stackID(force) + " (via force-reduce)");
        let done = this.advanceFully(force, newStacks);
        if (done)
          break;
        if (verbose)
          forceBase = this.stackID(force) + " -> ";
      }
      for (let insert of stack.recoverByInsert(token)) {
        if (verbose)
          console.log(base + this.stackID(insert) + " (via recover-insert)");
        this.advanceFully(insert, newStacks);
      }
      if (this.stream.end > stack.pos) {
        if (tokenEnd == stack.pos) {
          tokenEnd++;
          token = 0;
        }
        stack.recoverByDelete(token, tokenEnd);
        if (verbose)
          console.log(base + this.stackID(stack) + ` (via recover-delete ${this.parser.getName(token)})`);
        pushStackDedup(stack, newStacks);
      } else if (!finished || finished.score < force.score) {
        finished = force;
      }
    }
    return finished;
  }
  // Convert the stack's buffer to a syntax tree.
  stackToTree(stack) {
    stack.close();
    return Tree.build({
      buffer: StackBufferCursor.create(stack),
      nodeSet: this.parser.nodeSet,
      topID: this.topTerm,
      maxBufferLength: this.parser.bufferLength,
      reused: this.reused,
      start: this.ranges[0].from,
      length: stack.pos - this.ranges[0].from,
      minRepeatType: this.parser.minRepeatTerm
    });
  }
  stackID(stack) {
    let id2 = (stackIDs || (stackIDs = /* @__PURE__ */ new WeakMap())).get(stack);
    if (!id2)
      stackIDs.set(stack, id2 = String.fromCodePoint(this.nextStackID++));
    return id2 + stack;
  }
};
function pushStackDedup(stack, newStacks) {
  for (let i = 0; i < newStacks.length; i++) {
    let other = newStacks[i];
    if (other.pos == stack.pos && other.sameState(stack)) {
      if (newStacks[i].score < stack.score)
        newStacks[i] = stack;
      return;
    }
  }
  newStacks.push(stack);
}
var Dialect = class {
  constructor(source, flags, disabled) {
    this.source = source;
    this.flags = flags;
    this.disabled = disabled;
  }
  allows(term) {
    return !this.disabled || this.disabled[term] == 0;
  }
};
var id = (x) => x;
var ContextTracker = class {
  /**
  Define a context tracker.
  */
  constructor(spec) {
    this.start = spec.start;
    this.shift = spec.shift || id;
    this.reduce = spec.reduce || id;
    this.reuse = spec.reuse || id;
    this.hash = spec.hash || (() => 0);
    this.strict = spec.strict !== false;
  }
};
var LRParser = class _LRParser extends Parser {
  /**
  @internal
  */
  constructor(spec) {
    super();
    this.wrappers = [];
    if (spec.version != 14)
      throw new RangeError(`Parser version (${spec.version}) doesn't match runtime version (${14})`);
    let nodeNames = spec.nodeNames.split(" ");
    this.minRepeatTerm = nodeNames.length;
    for (let i = 0; i < spec.repeatNodeCount; i++)
      nodeNames.push("");
    let topTerms = Object.keys(spec.topRules).map((r) => spec.topRules[r][1]);
    let nodeProps = [];
    for (let i = 0; i < nodeNames.length; i++)
      nodeProps.push([]);
    function setProp(nodeID, prop, value) {
      nodeProps[nodeID].push([prop, prop.deserialize(String(value))]);
    }
    if (spec.nodeProps)
      for (let propSpec of spec.nodeProps) {
        let prop = propSpec[0];
        if (typeof prop == "string")
          prop = NodeProp[prop];
        for (let i = 1; i < propSpec.length; ) {
          let next = propSpec[i++];
          if (next >= 0) {
            setProp(next, prop, propSpec[i++]);
          } else {
            let value = propSpec[i + -next];
            for (let j = -next; j > 0; j--)
              setProp(propSpec[i++], prop, value);
            i++;
          }
        }
      }
    this.nodeSet = new NodeSet(nodeNames.map((name2, i) => NodeType.define({
      name: i >= this.minRepeatTerm ? void 0 : name2,
      id: i,
      props: nodeProps[i],
      top: topTerms.indexOf(i) > -1,
      error: i == 0,
      skipped: spec.skippedNodes && spec.skippedNodes.indexOf(i) > -1
    })));
    if (spec.propSources)
      this.nodeSet = this.nodeSet.extend(...spec.propSources);
    this.strict = false;
    this.bufferLength = DefaultBufferLength;
    let tokenArray = decodeArray(spec.tokenData);
    this.context = spec.context;
    this.specializerSpecs = spec.specialized || [];
    this.specialized = new Uint16Array(this.specializerSpecs.length);
    for (let i = 0; i < this.specializerSpecs.length; i++)
      this.specialized[i] = this.specializerSpecs[i].term;
    this.specializers = this.specializerSpecs.map(getSpecializer);
    this.states = decodeArray(spec.states, Uint32Array);
    this.data = decodeArray(spec.stateData);
    this.goto = decodeArray(spec.goto);
    this.maxTerm = spec.maxTerm;
    this.tokenizers = spec.tokenizers.map((value) => typeof value == "number" ? new TokenGroup(tokenArray, value) : value);
    this.topRules = spec.topRules;
    this.dialects = spec.dialects || {};
    this.dynamicPrecedences = spec.dynamicPrecedences || null;
    this.tokenPrecTable = spec.tokenPrec;
    this.termNames = spec.termNames || null;
    this.maxNode = this.nodeSet.types.length - 1;
    this.dialect = this.parseDialect();
    this.top = this.topRules[Object.keys(this.topRules)[0]];
  }
  createParse(input, fragments, ranges) {
    let parse = new Parse(this, input, fragments, ranges);
    for (let w of this.wrappers)
      parse = w(parse, input, fragments, ranges);
    return parse;
  }
  /**
  Get a goto table entry @internal
  */
  getGoto(state, term, loose = false) {
    let table = this.goto;
    if (term >= table[0])
      return -1;
    for (let pos = table[term + 1]; ; ) {
      let groupTag = table[pos++], last = groupTag & 1;
      let target = table[pos++];
      if (last && loose)
        return target;
      for (let end = pos + (groupTag >> 1); pos < end; pos++)
        if (table[pos] == state)
          return target;
      if (last)
        return -1;
    }
  }
  /**
  Check if this state has an action for a given terminal @internal
  */
  hasAction(state, terminal) {
    let data = this.data;
    for (let set = 0; set < 2; set++) {
      for (let i = this.stateSlot(
        state,
        set ? 2 : 1
        /* ParseState.Actions */
      ), next; ; i += 3) {
        if ((next = data[i]) == 65535) {
          if (data[i + 1] == 1)
            next = data[i = pair(data, i + 2)];
          else if (data[i + 1] == 2)
            return pair(data, i + 2);
          else
            break;
        }
        if (next == terminal || next == 0)
          return pair(data, i + 1);
      }
    }
    return 0;
  }
  /**
  @internal
  */
  stateSlot(state, slot) {
    return this.states[state * 6 + slot];
  }
  /**
  @internal
  */
  stateFlag(state, flag) {
    return (this.stateSlot(
      state,
      0
      /* ParseState.Flags */
    ) & flag) > 0;
  }
  /**
  @internal
  */
  validAction(state, action) {
    return !!this.allActions(state, (a) => a == action ? true : null);
  }
  /**
  @internal
  */
  allActions(state, action) {
    let deflt = this.stateSlot(
      state,
      4
      /* ParseState.DefaultReduce */
    );
    let result = deflt ? action(deflt) : void 0;
    for (let i = this.stateSlot(
      state,
      1
      /* ParseState.Actions */
    ); result == null; i += 3) {
      if (this.data[i] == 65535) {
        if (this.data[i + 1] == 1)
          i = pair(this.data, i + 2);
        else
          break;
      }
      result = action(pair(this.data, i + 1));
    }
    return result;
  }
  /**
  Get the states that can follow this one through shift actions or
  goto jumps. @internal
  */
  nextStates(state) {
    let result = [];
    for (let i = this.stateSlot(
      state,
      1
      /* ParseState.Actions */
    ); ; i += 3) {
      if (this.data[i] == 65535) {
        if (this.data[i + 1] == 1)
          i = pair(this.data, i + 2);
        else
          break;
      }
      if ((this.data[i + 2] & 65536 >> 16) == 0) {
        let value = this.data[i + 1];
        if (!result.some((v, i2) => i2 & 1 && v == value))
          result.push(this.data[i], value);
      }
    }
    return result;
  }
  /**
  Configure the parser. Returns a new parser instance that has the
  given settings modified. Settings not provided in `config` are
  kept from the original parser.
  */
  configure(config) {
    let copy = Object.assign(Object.create(_LRParser.prototype), this);
    if (config.props)
      copy.nodeSet = this.nodeSet.extend(...config.props);
    if (config.top) {
      let info = this.topRules[config.top];
      if (!info)
        throw new RangeError(`Invalid top rule name ${config.top}`);
      copy.top = info;
    }
    if (config.tokenizers)
      copy.tokenizers = this.tokenizers.map((t2) => {
        let found = config.tokenizers.find((r) => r.from == t2);
        return found ? found.to : t2;
      });
    if (config.specializers) {
      copy.specializers = this.specializers.slice();
      copy.specializerSpecs = this.specializerSpecs.map((s, i) => {
        let found = config.specializers.find((r) => r.from == s.external);
        if (!found)
          return s;
        let spec = Object.assign(Object.assign({}, s), { external: found.to });
        copy.specializers[i] = getSpecializer(spec);
        return spec;
      });
    }
    if (config.contextTracker)
      copy.context = config.contextTracker;
    if (config.dialect)
      copy.dialect = this.parseDialect(config.dialect);
    if (config.strict != null)
      copy.strict = config.strict;
    if (config.wrap)
      copy.wrappers = copy.wrappers.concat(config.wrap);
    if (config.bufferLength != null)
      copy.bufferLength = config.bufferLength;
    return copy;
  }
  /**
  Tells you whether any [parse wrappers](#lr.ParserConfig.wrap)
  are registered for this parser.
  */
  hasWrappers() {
    return this.wrappers.length > 0;
  }
  /**
  Returns the name associated with a given term. This will only
  work for all terms when the parser was generated with the
  `--names` option. By default, only the names of tagged terms are
  stored.
  */
  getName(term) {
    return this.termNames ? this.termNames[term] : String(term <= this.maxNode && this.nodeSet.types[term].name || term);
  }
  /**
  The eof term id is always allocated directly after the node
  types. @internal
  */
  get eofTerm() {
    return this.maxNode + 1;
  }
  /**
  The type of top node produced by the parser.
  */
  get topNode() {
    return this.nodeSet.types[this.top[1]];
  }
  /**
  @internal
  */
  dynamicPrecedence(term) {
    let prec = this.dynamicPrecedences;
    return prec == null ? 0 : prec[term] || 0;
  }
  /**
  @internal
  */
  parseDialect(dialect) {
    let values = Object.keys(this.dialects), flags = values.map(() => false);
    if (dialect)
      for (let part of dialect.split(" ")) {
        let id2 = values.indexOf(part);
        if (id2 >= 0)
          flags[id2] = true;
      }
    let disabled = null;
    for (let i = 0; i < values.length; i++)
      if (!flags[i]) {
        for (let j = this.dialects[values[i]], id2; (id2 = this.data[j++]) != 65535; )
          (disabled || (disabled = new Uint8Array(this.maxTerm + 1)))[id2] = 1;
      }
    return new Dialect(dialect, flags, disabled);
  }
  /**
  Used by the output of the parser generator. Not available to
  user code. @hide
  */
  static deserialize(spec) {
    return new _LRParser(spec);
  }
};
function pair(data, off) {
  return data[off] | data[off + 1] << 16;
}
function findFinished(stacks) {
  let best = null;
  for (let stack of stacks) {
    let stopped = stack.p.stoppedAt;
    if ((stack.pos == stack.p.stream.end || stopped != null && stack.pos > stopped) && stack.p.parser.stateFlag(
      stack.state,
      2
      /* StateFlag.Accepting */
    ) && (!best || best.score < stack.score))
      best = stack;
  }
  return best;
}
function getSpecializer(spec) {
  if (spec.external) {
    let mask = spec.extend ? 1 : 0;
    return (value, stack) => spec.external(value, stack) << 1 | mask;
  }
  return spec.get;
}

// node_modules/@mavnn/codemirror-lang-ink/dist/index.js
import * as import_language from "@codemirror/language";

// node_modules/@lezer/highlight/dist/index.js
var nextTagID = 0;
var Tag = class _Tag {
  /**
  @internal
  */
  constructor(name2, set, base, modified) {
    this.name = name2;
    this.set = set;
    this.base = base;
    this.modified = modified;
    this.id = nextTagID++;
  }
  toString() {
    let { name: name2 } = this;
    for (let mod of this.modified)
      if (mod.name)
        name2 = `${mod.name}(${name2})`;
    return name2;
  }
  static define(nameOrParent, parent) {
    let name2 = typeof nameOrParent == "string" ? nameOrParent : "?";
    if (nameOrParent instanceof _Tag)
      parent = nameOrParent;
    if (parent === null || parent === void 0 ? void 0 : parent.base)
      throw new Error("Can not derive from a modified tag");
    let tag = new _Tag(name2, [], null, []);
    tag.set.push(tag);
    if (parent)
      for (let t2 of parent.set)
        tag.set.push(t2);
    return tag;
  }
  /**
  Define a tag _modifier_, which is a function that, given a tag,
  will return a tag that is a subtag of the original. Applying the
  same modifier to a twice tag will return the same value (`m1(t1)
  == m1(t1)`) and applying multiple modifiers will, regardless or
  order, produce the same tag (`m1(m2(t1)) == m2(m1(t1))`).
  
  When multiple modifiers are applied to a given base tag, each
  smaller set of modifiers is registered as a parent, so that for
  example `m1(m2(m3(t1)))` is a subtype of `m1(m2(t1))`,
  `m1(m3(t1)`, and so on.
  */
  static defineModifier(name2) {
    let mod = new Modifier(name2);
    return (tag) => {
      if (tag.modified.indexOf(mod) > -1)
        return tag;
      return Modifier.get(tag.base || tag, tag.modified.concat(mod).sort((a, b) => a.id - b.id));
    };
  }
};
var nextModifierID = 0;
var Modifier = class _Modifier {
  constructor(name2) {
    this.name = name2;
    this.instances = [];
    this.id = nextModifierID++;
  }
  static get(base, mods) {
    if (!mods.length)
      return base;
    let exists = mods[0].instances.find((t2) => t2.base == base && sameArray(mods, t2.modified));
    if (exists)
      return exists;
    let set = [], tag = new Tag(base.name, set, base, mods);
    for (let m of mods)
      m.instances.push(tag);
    let configs = powerSet(mods);
    for (let parent of base.set)
      if (!parent.modified.length)
        for (let config of configs)
          set.push(_Modifier.get(parent, config));
    return tag;
  }
};
function sameArray(a, b) {
  return a.length == b.length && a.every((x, i) => x == b[i]);
}
function powerSet(array) {
  let sets = [[]];
  for (let i = 0; i < array.length; i++) {
    for (let j = 0, e = sets.length; j < e; j++) {
      sets.push(sets[j].concat(array[i]));
    }
  }
  return sets.sort((a, b) => b.length - a.length);
}
function styleTags(spec) {
  let byName = /* @__PURE__ */ Object.create(null);
  for (let prop in spec) {
    let tags2 = spec[prop];
    if (!Array.isArray(tags2))
      tags2 = [tags2];
    for (let part of prop.split(" "))
      if (part) {
        let pieces = [], mode = 2, rest = part;
        for (let pos = 0; ; ) {
          if (rest == "..." && pos > 0 && pos + 3 == part.length) {
            mode = 1;
            break;
          }
          let m = /^"(?:[^"\\]|\\.)*?"|[^\/!]+/.exec(rest);
          if (!m)
            throw new RangeError("Invalid path: " + part);
          pieces.push(m[0] == "*" ? "" : m[0][0] == '"' ? JSON.parse(m[0]) : m[0]);
          pos += m[0].length;
          if (pos == part.length)
            break;
          let next = part[pos++];
          if (pos == part.length && next == "!") {
            mode = 0;
            break;
          }
          if (next != "/")
            throw new RangeError("Invalid path: " + part);
          rest = part.slice(pos);
        }
        let last = pieces.length - 1, inner = pieces[last];
        if (!inner)
          throw new RangeError("Invalid path: " + part);
        let rule = new Rule(tags2, mode, last > 0 ? pieces.slice(0, last) : null);
        byName[inner] = rule.sort(byName[inner]);
      }
  }
  return ruleNodeProp.add(byName);
}
var ruleNodeProp = new NodeProp({
  combine(a, b) {
    let cur, root, take;
    while (a || b) {
      if (!a || b && a.depth >= b.depth) {
        take = b;
        b = b.next;
      } else {
        take = a;
        a = a.next;
      }
      if (cur && cur.mode == take.mode && !take.context && !cur.context)
        continue;
      let copy = new Rule(take.tags, take.mode, take.context);
      if (cur)
        cur.next = copy;
      else
        root = copy;
      cur = copy;
    }
    return root;
  }
});
var Rule = class {
  constructor(tags2, mode, context, next) {
    this.tags = tags2;
    this.mode = mode;
    this.context = context;
    this.next = next;
  }
  get opaque() {
    return this.mode == 0;
  }
  get inherit() {
    return this.mode == 1;
  }
  sort(other) {
    if (!other || other.depth < this.depth) {
      this.next = other;
      return this;
    }
    other.next = this.sort(other.next);
    return other;
  }
  get depth() {
    return this.context ? this.context.length : 0;
  }
};
Rule.empty = new Rule([], 2, null);
function tagHighlighter(tags2, options) {
  let map = /* @__PURE__ */ Object.create(null);
  for (let style of tags2) {
    if (!Array.isArray(style.tag))
      map[style.tag.id] = style.class;
    else
      for (let tag of style.tag)
        map[tag.id] = style.class;
  }
  let { scope, all = null } = options || {};
  return {
    style: (tags3) => {
      let cls = all;
      for (let tag of tags3) {
        for (let sub of tag.set) {
          let tagClass = map[sub.id];
          if (tagClass) {
            cls = cls ? cls + " " + tagClass : tagClass;
            break;
          }
        }
      }
      return cls;
    },
    scope
  };
}
var t = Tag.define;
var comment = t();
var name = t();
var typeName = t(name);
var propertyName = t(name);
var literal = t();
var string = t(literal);
var number = t(literal);
var content = t();
var heading = t(content);
var keyword = t();
var operator = t();
var punctuation = t();
var bracket = t(punctuation);
var meta = t();
var tags = {
  /**
  A comment.
  */
  comment,
  /**
  A line [comment](#highlight.tags.comment).
  */
  lineComment: t(comment),
  /**
  A block [comment](#highlight.tags.comment).
  */
  blockComment: t(comment),
  /**
  A documentation [comment](#highlight.tags.comment).
  */
  docComment: t(comment),
  /**
  Any kind of identifier.
  */
  name,
  /**
  The [name](#highlight.tags.name) of a variable.
  */
  variableName: t(name),
  /**
  A type [name](#highlight.tags.name).
  */
  typeName,
  /**
  A tag name (subtag of [`typeName`](#highlight.tags.typeName)).
  */
  tagName: t(typeName),
  /**
  A property or field [name](#highlight.tags.name).
  */
  propertyName,
  /**
  An attribute name (subtag of [`propertyName`](#highlight.tags.propertyName)).
  */
  attributeName: t(propertyName),
  /**
  The [name](#highlight.tags.name) of a class.
  */
  className: t(name),
  /**
  A label [name](#highlight.tags.name).
  */
  labelName: t(name),
  /**
  A namespace [name](#highlight.tags.name).
  */
  namespace: t(name),
  /**
  The [name](#highlight.tags.name) of a macro.
  */
  macroName: t(name),
  /**
  A literal value.
  */
  literal,
  /**
  A string [literal](#highlight.tags.literal).
  */
  string,
  /**
  A documentation [string](#highlight.tags.string).
  */
  docString: t(string),
  /**
  A character literal (subtag of [string](#highlight.tags.string)).
  */
  character: t(string),
  /**
  An attribute value (subtag of [string](#highlight.tags.string)).
  */
  attributeValue: t(string),
  /**
  A number [literal](#highlight.tags.literal).
  */
  number,
  /**
  An integer [number](#highlight.tags.number) literal.
  */
  integer: t(number),
  /**
  A floating-point [number](#highlight.tags.number) literal.
  */
  float: t(number),
  /**
  A boolean [literal](#highlight.tags.literal).
  */
  bool: t(literal),
  /**
  Regular expression [literal](#highlight.tags.literal).
  */
  regexp: t(literal),
  /**
  An escape [literal](#highlight.tags.literal), for example a
  backslash escape in a string.
  */
  escape: t(literal),
  /**
  A color [literal](#highlight.tags.literal).
  */
  color: t(literal),
  /**
  A URL [literal](#highlight.tags.literal).
  */
  url: t(literal),
  /**
  A language keyword.
  */
  keyword,
  /**
  The [keyword](#highlight.tags.keyword) for the self or this
  object.
  */
  self: t(keyword),
  /**
  The [keyword](#highlight.tags.keyword) for null.
  */
  null: t(keyword),
  /**
  A [keyword](#highlight.tags.keyword) denoting some atomic value.
  */
  atom: t(keyword),
  /**
  A [keyword](#highlight.tags.keyword) that represents a unit.
  */
  unit: t(keyword),
  /**
  A modifier [keyword](#highlight.tags.keyword).
  */
  modifier: t(keyword),
  /**
  A [keyword](#highlight.tags.keyword) that acts as an operator.
  */
  operatorKeyword: t(keyword),
  /**
  A control-flow related [keyword](#highlight.tags.keyword).
  */
  controlKeyword: t(keyword),
  /**
  A [keyword](#highlight.tags.keyword) that defines something.
  */
  definitionKeyword: t(keyword),
  /**
  A [keyword](#highlight.tags.keyword) related to defining or
  interfacing with modules.
  */
  moduleKeyword: t(keyword),
  /**
  An operator.
  */
  operator,
  /**
  An [operator](#highlight.tags.operator) that dereferences something.
  */
  derefOperator: t(operator),
  /**
  Arithmetic-related [operator](#highlight.tags.operator).
  */
  arithmeticOperator: t(operator),
  /**
  Logical [operator](#highlight.tags.operator).
  */
  logicOperator: t(operator),
  /**
  Bit [operator](#highlight.tags.operator).
  */
  bitwiseOperator: t(operator),
  /**
  Comparison [operator](#highlight.tags.operator).
  */
  compareOperator: t(operator),
  /**
  [Operator](#highlight.tags.operator) that updates its operand.
  */
  updateOperator: t(operator),
  /**
  [Operator](#highlight.tags.operator) that defines something.
  */
  definitionOperator: t(operator),
  /**
  Type-related [operator](#highlight.tags.operator).
  */
  typeOperator: t(operator),
  /**
  Control-flow [operator](#highlight.tags.operator).
  */
  controlOperator: t(operator),
  /**
  Program or markup punctuation.
  */
  punctuation,
  /**
  [Punctuation](#highlight.tags.punctuation) that separates
  things.
  */
  separator: t(punctuation),
  /**
  Bracket-style [punctuation](#highlight.tags.punctuation).
  */
  bracket,
  /**
  Angle [brackets](#highlight.tags.bracket) (usually `<` and `>`
  tokens).
  */
  angleBracket: t(bracket),
  /**
  Square [brackets](#highlight.tags.bracket) (usually `[` and `]`
  tokens).
  */
  squareBracket: t(bracket),
  /**
  Parentheses (usually `(` and `)` tokens). Subtag of
  [bracket](#highlight.tags.bracket).
  */
  paren: t(bracket),
  /**
  Braces (usually `{` and `}` tokens). Subtag of
  [bracket](#highlight.tags.bracket).
  */
  brace: t(bracket),
  /**
  Content, for example plain text in XML or markup documents.
  */
  content,
  /**
  [Content](#highlight.tags.content) that represents a heading.
  */
  heading,
  /**
  A level 1 [heading](#highlight.tags.heading).
  */
  heading1: t(heading),
  /**
  A level 2 [heading](#highlight.tags.heading).
  */
  heading2: t(heading),
  /**
  A level 3 [heading](#highlight.tags.heading).
  */
  heading3: t(heading),
  /**
  A level 4 [heading](#highlight.tags.heading).
  */
  heading4: t(heading),
  /**
  A level 5 [heading](#highlight.tags.heading).
  */
  heading5: t(heading),
  /**
  A level 6 [heading](#highlight.tags.heading).
  */
  heading6: t(heading),
  /**
  A prose [content](#highlight.tags.content) separator (such as a horizontal rule).
  */
  contentSeparator: t(content),
  /**
  [Content](#highlight.tags.content) that represents a list.
  */
  list: t(content),
  /**
  [Content](#highlight.tags.content) that represents a quote.
  */
  quote: t(content),
  /**
  [Content](#highlight.tags.content) that is emphasized.
  */
  emphasis: t(content),
  /**
  [Content](#highlight.tags.content) that is styled strong.
  */
  strong: t(content),
  /**
  [Content](#highlight.tags.content) that is part of a link.
  */
  link: t(content),
  /**
  [Content](#highlight.tags.content) that is styled as code or
  monospace.
  */
  monospace: t(content),
  /**
  [Content](#highlight.tags.content) that has a strike-through
  style.
  */
  strikethrough: t(content),
  /**
  Inserted text in a change-tracking format.
  */
  inserted: t(),
  /**
  Deleted text.
  */
  deleted: t(),
  /**
  Changed text.
  */
  changed: t(),
  /**
  An invalid or unsyntactic element.
  */
  invalid: t(),
  /**
  Metadata or meta-instruction.
  */
  meta,
  /**
  [Metadata](#highlight.tags.meta) that applies to the entire
  document.
  */
  documentMeta: t(meta),
  /**
  [Metadata](#highlight.tags.meta) that annotates or adds
  attributes to a given syntactic element.
  */
  annotation: t(meta),
  /**
  Processing instruction or preprocessor directive. Subtag of
  [meta](#highlight.tags.meta).
  */
  processingInstruction: t(meta),
  /**
  [Modifier](#highlight.Tag^defineModifier) that indicates that a
  given element is being defined. Expected to be used with the
  various [name](#highlight.tags.name) tags.
  */
  definition: Tag.defineModifier("definition"),
  /**
  [Modifier](#highlight.Tag^defineModifier) that indicates that
  something is constant. Mostly expected to be used with
  [variable names](#highlight.tags.variableName).
  */
  constant: Tag.defineModifier("constant"),
  /**
  [Modifier](#highlight.Tag^defineModifier) used to indicate that
  a [variable](#highlight.tags.variableName) or [property
  name](#highlight.tags.propertyName) is being called or defined
  as a function.
  */
  function: Tag.defineModifier("function"),
  /**
  [Modifier](#highlight.Tag^defineModifier) that can be applied to
  [names](#highlight.tags.name) to indicate that they belong to
  the language's standard environment.
  */
  standard: Tag.defineModifier("standard"),
  /**
  [Modifier](#highlight.Tag^defineModifier) that indicates a given
  [names](#highlight.tags.name) is local to some scope.
  */
  local: Tag.defineModifier("local"),
  /**
  A generic variant [modifier](#highlight.Tag^defineModifier) that
  can be used to tag language-specific alternative variants of
  some common tag. It is recommended for themes to define special
  forms of at least the [string](#highlight.tags.string) and
  [variable name](#highlight.tags.variableName) tags, since those
  come up a lot.
  */
  special: Tag.defineModifier("special")
};
for (let name2 in tags) {
  let val = tags[name2];
  if (val instanceof Tag)
    val.name = name2;
}
var classHighlighter = tagHighlighter([
  { tag: tags.link, class: "tok-link" },
  { tag: tags.heading, class: "tok-heading" },
  { tag: tags.emphasis, class: "tok-emphasis" },
  { tag: tags.strong, class: "tok-strong" },
  { tag: tags.keyword, class: "tok-keyword" },
  { tag: tags.atom, class: "tok-atom" },
  { tag: tags.bool, class: "tok-bool" },
  { tag: tags.url, class: "tok-url" },
  { tag: tags.labelName, class: "tok-labelName" },
  { tag: tags.inserted, class: "tok-inserted" },
  { tag: tags.deleted, class: "tok-deleted" },
  { tag: tags.literal, class: "tok-literal" },
  { tag: tags.string, class: "tok-string" },
  { tag: tags.number, class: "tok-number" },
  { tag: [tags.regexp, tags.escape, tags.special(tags.string)], class: "tok-string2" },
  { tag: tags.variableName, class: "tok-variableName" },
  { tag: tags.local(tags.variableName), class: "tok-variableName tok-local" },
  { tag: tags.definition(tags.variableName), class: "tok-variableName tok-definition" },
  { tag: tags.special(tags.variableName), class: "tok-variableName2" },
  { tag: tags.definition(tags.propertyName), class: "tok-propertyName tok-definition" },
  { tag: tags.typeName, class: "tok-typeName" },
  { tag: tags.namespace, class: "tok-namespace" },
  { tag: tags.className, class: "tok-className" },
  { tag: tags.macroName, class: "tok-macroName" },
  { tag: tags.propertyName, class: "tok-propertyName" },
  { tag: tags.operator, class: "tok-operator" },
  { tag: tags.comment, class: "tok-comment" },
  { tag: tags.meta, class: "tok-meta" },
  { tag: tags.invalid, class: "tok-invalid" },
  { tag: tags.punctuation, class: "tok-punctuation" }
]);

// node_modules/@mavnn/codemirror-lang-ink/dist/index.js
var endOfKnotMarker = 105;
var endOfStitchMarker = 106;
var inlineConditionalOpen = 107;
var inlineSequenceOpen = 108;
var inlineDisplayVariableOpen = 109;
var blockOpen = 110;
var KnotName = 77;
var StitchName = 81;
var pipe = 124;
var colon = 58;
var braceL = 123;
var braceR = 125;
var newLine = 10;
var equal = 61;
var endOfKnot = new ExternalTokenizer((input, stack) => {
  const doubleEquals = input.peek(0) == equal && input.peek(1) == equal;
  const endOfFile = input.peek(0) == -1;
  if (stack.context.inKnot && (doubleEquals || endOfFile)) {
    input.acceptToken(endOfKnotMarker);
    return;
  }
  if (stack.context.inStitch && input.peek(0) == equal) {
    input.acceptToken(endOfStitchMarker);
    return;
  }
}, { contextual: true });
var checkBrace = new ExternalTokenizer((input) => {
  let ahead = 0;
  let peeked = input.peek(0);
  let nestedOpeningCount = 0;
  while (peeked !== -1) {
    if (peeked === braceL) {
      nestedOpeningCount++;
      ahead++;
      peeked = input.peek(ahead);
    } else if (peeked === pipe) {
      input.acceptToken(inlineSequenceOpen);
      return;
    } else if (peeked === braceR) {
      if (nestedOpeningCount === 0) {
        input.acceptToken(inlineDisplayVariableOpen);
        return;
      } else {
        nestedOpeningCount--;
        ahead++;
        peeked = input.peek(ahead);
      }
    } else if (peeked === colon) {
      ahead++;
      peeked = input.peek(ahead);
      while (peeked !== -1) {
        if (peeked === braceL) {
          nestedOpeningCount++;
          ahead++;
          peeked = input.peek(ahead);
        } else if (peeked === newLine) {
          input.acceptToken(blockOpen);
          return;
        } else if (peeked === braceR) {
          if (nestedOpeningCount === 0) {
            input.acceptToken(inlineConditionalOpen);
            return;
          } else {
            nestedOpeningCount--;
          }
        }
        ahead++;
        peeked = input.peek(ahead);
      }
    } else if (peeked === newLine) {
      return;
    } else {
      ahead++;
      peeked = input.peek(ahead);
    }
  }
}, { fallback: true });
var KnotContext = class {
  inKnot;
  inStitch;
  constructor(inKnot, inStitch) {
    this.inKnot = inKnot;
    this.inStitch = inStitch;
  }
};
var trackKnotName = new ContextTracker({
  start: new KnotContext(false, false),
  reduce(context, term) {
    if (term == KnotName) {
      return new KnotContext(true, false);
    } else if (term == StitchName) {
      return new KnotContext(true, true);
    } else {
      return context;
    }
  }
});
var spec_contentWord = { __proto__: null, "TODO:": 247, INCLUDE: 337, VAR: 339, CONST: 343, LIST: 345, STACK: 349, "-": 393, "--": 395, "---": 397, "----": 399, "-----": 401, "------": 403, "-------": 405, "(": 411 };
var spec_identifier = { __proto__: null, not: 36, END: 54, DONE: 56, true: 62, false: 64, stopping: 142, shuffle: 144, cycle: 146, once: 148, ref: 158, function: 166 };
var spec_arrowToken = { __proto__: null, "->": 299, "->->": 323 };
var spec_choiceContentWord = { __proto__: null, "(": 375, "[": 383 };
var parser = LRParser.deserialize({
  version: 14,
  states: "!!YO!yQSOOP#QOSOOO#VQWO'#C_OOQO'#Ey'#EyO#_QWO'#C`OOQO'#Ct'#CtOOQO'#DR'#DRO#dQ`O'#DQOOQO'#DQ'#DQO#{QUO'#DSOOQO'#FP'#FPOOQO'#E}'#E}OOQO'#EU'#EUO$uQSO'#FxO%SQpO'#DXOOQO'#EZ'#EZO%XQSO'#FyO%mQSO'#E|OOQO'#Ca'#CaO%zQ`O'#DaO&VQ!bO'#DfO&VQ!bO'#DnOOQO'#GY'#GYO&hQSO'#DoO&xQ`O'#DqOOQO'#Ex'#ExO'TQ`O'#DzOOQO'#Gw'#GwOOQO'#Ew'#EwO$XQSO'#ETQYQSOOO#_QWO'#DYO']Q`O'#DZO']Q`O'#D[O']Q`O'#D]O']Q`O'#D`OOQO'#Gg'#GgOYQSOOP'bO!LQO'#C]POOO)C@e)C@eOOQO'#ES'#ESO'gQWO,58yOOQP,58y,58yO'oQWO,58zO'wQ`O'#CvOOQO'#Cu'#CuO(`QSO,59lO)fQ`O,58}O*UQ#tO,59nO']Q`O,59rOOQP'#GP'#GPO*]Q`O,5:`OOQP'#Ed'#EdO+wQSO,5:^O,RQUO'#DSOOQO-E8S-E8SO,^QSO,5<dOOQO,5<d,5<dO,oQSO,5<dOOQO'#E['#E[O,}QpO,59sOOQO-E8X-E8XOOQO,5<e,5<eO-fQSO,5<eO-tQSO,5;hO.RQSO,5;hOOQO,5;h,5;hO.dQSO,5;hOOQO'#Cp'#CpOOQO'#Db'#DbOOQO'#Dc'#DcO.rQ&jO,59{O']Q`O,59{OOQO'#G]'#G]O']Q`O'#DgO(tQ`O'#DhOOQO'#E^'#E^O/TQ!bO'#G[OOQO'#Ga'#GaO/cQ!bO'#DiOOQO'#Gb'#GbO0QQ!bO'#DjO0tQ!bO'#G`O0{Q!bO'#G`O1YQSO'#G[O/TQ!bO'#G[OOQO,5:Q,5:QOOQO,5:Y,5:YOOQO'#Gp'#GpO']Q`O'#DpO1kQSO'#GoOOQO'#Gr'#GrOOQO,5:Z,5:ZOOQO,5:],5:]OOQO'#D{'#D{O1xQ`O'#GyO$XQSO,5:fO'WQ`O,5:lO2WQSO,5:oOOQO-E8R-E8RO4QQWO,59tO4YQ&jO,59uO4_Q&jO,59vO4dQ&jO,59wO4iQ`O,59zP4nO!LQO,58wOOQO-E8Q-E8QOOQP1G.e1G.eOOQO1G.f1G.fO4sQ`O,59bOOQO1G/W1G/WO5gQ,UO1G.iOOQO'#FT'#FTO6]Q`O'#ClO6gQ,UO'#FSO7nQ`O'#CsO7yQ`O'#CyO8QOMhO'#FkOOQO'#C}'#C}OOQO'#DO'#DOOOQO'#DP'#DPOOQO'#Fj'#FjOOQO'#FS'#FSO(tQ`O1G.iO(tQ`O'#CmOOQO'#Cz'#CzOOQO'#DU'#DUO8nQSO'#DUO8xQSO'#FuO9QQSO1G/YO)mQSO1G/YO9VQ`O1G/^O9_Q,UO1G/xO9fQ`O1G/zOOQO'#Gv'#GvO(tQ`O1G/xO(tQ`O'#DsOOQO'#Gu'#GuO$XQSO'#EbO9kQSO1G/xOOQP-E8b-E8bOOQO'#Gt'#GtOOQO1G2O1G2OOOQO-E8Y-E8YOOQO1G2P1G2PO9rQSO1G1SOOQO1G1S1G1SO:TQSO1G1SO:wQ`O'#DdOOQO'#De'#DeOOQO1G/g1G/gO(tQ`O1G/gO;OQ&jO1G/gO;aQ`O,5:RO;fQ,UO,5:SOOQO-E8[-E8[O;mQSO,5<vOOQO'#E_'#E_O<OQ!bO,5:TO<mQ!bO'#DkO=OQ`O,5:UO=WQ!bO,5<zO=rQ!bO'#DmOOQO,5<z,5<zO>^Q7[O'#DlOOQO'#E`'#E`O;mQSO,5<vOOQO,5<v,5<vO/TQ!bO,5<vO>fQ`O,5:[OOQO,5=Z,5=ZO>kQ`O'#D|OOQO,5=e,5=eO>vQSO,5=eO@rQTO1G0QO$XQSO1G0WOOQO1G/`1G/`O@yQ`O1G/aO@yQ`O1G/bOAeQ`O1G/cOBXQ`O1G/fPOOO1G.c1G.cOOQO1G.|1G.|O(tQ`O,59OO(tQ`O,59PO(tQ`O,59QO(tQ`O,59RO(tQ`O,59SO(tQ`O,59TO(tQ`O,59UO(tQ`O,59VOB`QSO7+$TOBkQ,UO,59WOBrQ,UO'#CpOCmQ`O'#FdOCuQ`O,59]OCzQ`O,59ZODRQ,UO'#CvOOQO,59_,59_OEYQ,UO'#FbOEgQ`O,59eOOOO'#EX'#EXOElOMhO,5<VOOQO,5<V,5<VOEwQ,UO7+$TOFOQ,UO,59XOOQO,59p,59pO)mQSO'#EYOFiQSO,5<aOOQO7+$t7+$tOFqQSO7+$tOOQO7+$x7+$xOCzQ`O7+$xOFvQSO7+%dO$XQSO7+%fOGTQ,UO7+%dOG[Q,UO,5:_OOQO,5:|,5:|OOQO-E8`-E8`OOQO7+%d7+%dOOQO7+&n7+&nOGcQ`O'#CqOOQO,5:O,5:OOGkQ,UO7+%ROOQO7+%R7+%RO(tQ`O7+%ROOQO1G/m1G/mOOQO1G/n1G/nOGuQSO1G2bOOQO1G2b1G2bOOQO-E8]-E8]OHWQ`O1G/pOOQO1G/p1G/pOOQO1G2f1G2fOOQO'#Ea'#EaOH`Q7[O,5:WOOQO-E8^-E8^OGuQSO1G2bOOQO1G/v1G/vOOQO'#G{'#G{OHzQ`O'#GzOISQ`O,5:hO']Q`O'#G{OOQO1G3P1G3PO$XQSO'#EfOIXQTO7+%lOOQO7+%l7+%lOI`Q`O'#EOOIeQSO7+%rOOQO7+${7+${OOQO7+$|7+$|OKRQ`O'#D_OKWQ`O'#D^OOQO7+$}7+$}OAkQ`O7+$}OOQO7+%Q7+%QOKcQ,UO1G.jOLPQ,UO1G.kOLpQ,UO1G.lOMdQ,UO1G.mONhQ,UO1G.nO! lQ,UO1G.oO!!pQ,UO1G.pOOQO1G.q1G.qO!#tQSO<<GoOOQO1G.r1G.rO!#{Q`O,59^O!$QQ`O'#EWO!$VQ`O,5<OOOQO1G.w1G.wO!$_Q`O1G.uO(tQ`O'#EVO!$dQ`O,5;|OOQO1G/P1G/POOOO-E8V-E8VOOQO1G1q1G1qOB`QSO<<GoOOQO,5:t,5:tOOQO-E8W-E8WOOQO<<H`<<H`O!$oQ`O<<HdO*pQSO<<IOO!$tQSO<<IOO!$|QSO<<IQO!%WQSO<<IOO!%eQSO1G/yO!%rQ`O'#CrO!%}Q,UO<<HmOOQO7+'|7+'|OOQO7+%[7+%[OOQO-E8_-E8_O!&XQSO7+'|O!&jQ`O'#EeO!&rQ`O,5=fOOQO1G0S1G0SOOQO,5=g,5=gO!&zQTO,5;QOOQP-E8d-E8dOOQO<<IW<<IWOOQO'#EP'#EPO!(tQ`O,5:jO$XQSO'#EgO!)SQTO<<I^O!)ZQ`O,59yOAeQ`O'#E]O!)`Q`O,59xOOQO<<Hi<<HiOOQOAN=ZAN=ZO!)kQSOAN=ZOOQO1G.x1G.xOOQO,5:r,5:rOOQO-E8U-E8UOOQO7+$a7+$aO!)pQ,UO,5:qOOQO-E8T-E8TO!)}QSOAN=ZO!*UQSOAN>OO!*ZQSOAN>jO*pQSOAN>jO!*bQSO'#DyO$XQSO'#EcO!*iQSOAN>lO!*vQSOAN>jOOQO7+%e7+%eOOQO<<Kh<<KhOOQO,5;P,5;POOQO-E8c-E8cOIeQSO1G0UO$XQSO1G0UO!+OQSO1G0UO!+ZQTO,5;ROOQP-E8e-E8eOOQOAN>xAN>xOOQO1G/e1G/eOOQO,5:w,5:wOAkQ`O,5:wOOQO-E8Z-E8ZOOQOG22uG22uO!-TQSOG22uOOQOG23jG23jOOQOG24UG24UO!-YQSOG24UOOQO,5:e,5:eOOQO,5:},5:}OOQO-E8a-E8aOOQOG24WG24WO*pQSOG24UO!-aQTO7+%pOIeQSO7+%pO$XQSO7+%pOOQO1G0c1G0cOOQOLD(aLD(aOOQOLD)pLD)pO!-kQSOLD)pOOQO<<I[<<I[O!-rQTO<<I[OIeQSO<<I[OOQO!$'M[!$'M[OOQOAN>vAN>vO!-|QTOAN>vOOQOG24bG24bO&xQ`O'#Cs",
  stateData: "!.t~O#dOS#ePQ~OUaO#nZO#oRO#rZO#tXO$ZTO$gUO$j^O$noO$opO$qqO$rrO$tsO$ucO$}dO%YeO%[tO%]tO%^tO%_tO%`tO%atO%btO%ghO%ljO~O#hQO~PYO#evO~O#ixO#jzO~O#ixO~Ok}Ol}O$T|O#htX#jtXytX$htX~O#_!PO#`!QO#a!RO#b!TO#hQO#j!SO~O#nZO#rZO#t!WO$ZTO$gUO$j^O~OU![O#h$lX#j$lX~P$aO$k!]O~OU!aO$ZTO$gUO$j^O#h$mX#j$mX~OU!eO#h#pX#j#pX~P$aO$T!fO$v!gO$w!hO~O#r!pO#t!mO%Q!pO%R!kO%V!rO~OUaO%e!zO#h%fP#j%fP~P$aOk}Ol}O$T|O~O!u#TO$T#QO~O$T!fO~O#f#]O~O#ixO#j#_O~O#ixO#j#`O~O$X#aO#hjX#jjX$ZjX$gjXyjX$hjX~O$ZTO$gUO#hta#jtayta$hta~Ob#pOo#qOp#qO$R#eO$T!fO$ZTO$[#hO$`#iO$d#kO$e#lO~O#u#oO~P(tO#nZO#rZO#t!WO$ZTO$gUOyxP$hxP~Ow#vO~P)mO!i#zO!j#zO!k#zO!l#zO#u#{O~P(tOUaO#nZO#oRO#rZO#tXO$ZTO$gUO$j^O$opO$qqO$rrO$tsO$ucO$}dO%YeO%[$RO%ghO~O#hQO#j!SO~P*pO#_!PO#`!QO#a!RO~O$ZTO$gUO$j^O#h$la#j$la~O$ZTO$gUO#h$la#j$la~O$k!]OU{a#h{a#j{a$Z{a$g{a$j{a~O$ZTO$gUO#h$ma#j$ma~OU$XO#h#pa#j#pa~P$aO$ZTO$gUO$j^O#h#pa#j#pa~O$ZTO$gUO#h#pa#j#pa~O$p$]O$x$YO$y$YO$z$ZO${$ZO~O#r!pO#t!mO%Q!pO%V!rO~O#r!pO#t!WO%Q!pO#h!]X#j!]X$Z!]X$g!]X$j!]X%V!]X~O#r!pO#t!WO%Q!pO$]!_P$j!_P~O#h%SX#j%SX$Z%SX$g%SX$j%SX~O%V!rO~P0cO#r!pO#t!WO%Q!pO~P0cO$ZTO$gUO$j$jO#h%OX#j%OX~OUaO#h%cX#j%cX~P$aO$R$qO%l$rO#h%mX#j%mX~O#hQO#j!SOU!wa#[!wa#n!wa#o!wa#r!wa#t!wa$Z!wa$g!wa$j!wa$n!wa$o!wa$q!wa$r!wa$t!wa$u!wa$}!wa%Y!wa%[!wa%]!wa%^!wa%_!wa%`!wa%a!wa%b!wa%g!wa%l!wa~O#ixO#j$vO~O$p$wO~O$p$xO~O$p$yO~O$d#kO~O#g${O~O$T$|O~O#x$}O#y%OO#z%PO#{%QO#|%QO#}%RO$O%SO$P%TO$Q%UO~O$f%VO~P4xOb#pOo#qOp#qO$R#eO$ZTO$[#hO$`#iO$d#kO$e#lO~O$T%XO$S$WP~P5nO$R%[O#x#vX#y#vX#z#vX#{#vX#|#vX#}#vX$O#vX$P#vX$Q#vX$f#vX$h#vX$S#vX$V#vX$]#vX#h#vX#j#vX~Ok}Ol}O$T%]O~O$]$UP~P(tO$a%aO$b%aO$c%cO~O#nZO#rZO#t!WO$ZTO$gUO~OyxX$hxX~P8]Oy%gO$h$iX~O$h%iO~O$R%lO$h%kO~O$f%mO~P4xO$f%nO~O$h%sO~P*pO$ZTO$gUO$j^O#h#pi#j#pi~O$ZTO$gUO#h#pi#j#pi~Oo#qOp#qO$T!fO$`#iO$d#kO$e#lO~O$R%uO~P:cO$p%yO$x$YO$y$YO$z$ZO${$ZO~O$S%zO~O$h%{O~P4xO$ZTO$gUO$j$jO#h%Oa#j%Oa~O#r!pO#t!WO%Q!pO#h!]a#j!]a$Z!]a$g!]a$j!]a%V!]a~O#r!pO#t!WO%Q!pO$]!_X$j!_X~O$]&QO$j$jO~O#r!pO#t!WO%Q!pO#h%Sa#j%Sa$Z%Sa$g%Sa$j%Sa~O#r!pO#t!WO%Q!pO#h!aX#j!aX$Z!aX$g!aX$j!aX~O%W&SO%X&SO~O$S&WO~O!q&[O$T!fO$S%nP~O%l&]O#h%ma#j%ma~OUaO#nZO#oRO#rZO#tXO$ZTO$gUO$j^O$noO$opO$qqO$rrO$tsO$ucO$}dO%YeO%[tO%]tO%^tO%_tO%`tO%atO%btO%ghO%p&aO~O#]&`O~P?ROo#qOp#qO$R%uO$ZTO$[#hO$`#iO$d#kO$e#lO~O#hQO#j!SO$R&eO$T!fO~Oo#qOp#qO$ZTO$`#iO$d#kO$e#lO~O$R%uO~PAsO#nZO#rZO#t!WO~O$S&sO~P4xO$X&tO#xdX#ydX#zdX#{dX#|dX#}dX$OdX$PdX$QdX$RdX$SfX$VfX~O$V&uO$S$WX~O$S&wO~O$S$UP~P(tO$X#aO#xjX#yjX#zjX#{jX#|jX#}jX$OjX$PjX$QjX$fjX$hjX$SjX$VjX$]jX#hjX#jjX~O$V&yO$]$UX$S$UX~P4xO$]&{O~O$a%aO$b%aO$c&}O~O$f'OO~P4xO$faa$haa$Saa$Vaa$]aa#haa#jaa~P4xOy%gO$h$ia~O$h'RO~OUaO#hQO#j'TO~P$aO$f'WO~P4xO$f'XO~P4xO$T'YO$S$WP~O#h!Tq#j!Tq~P4xO$ZTO$gUO$j$jO#h%Oi#j%Oi~O$]']O$j$jO~O%W&SO%X&SO#h!`a#j!`a$Z!`a$g!`a$j!`a$]!`a~O$V'`O$S%nX~O$S'bO~O#]'fO~P?RO$T'gO~OUaO#nZO#oRO#rZO#tXO$ZTO$gUO$j^O$noO$opO$qqO$rrO$tsO$ucO$}dO%YeO%[tO%]tO%^tO%_tO%`tO%atO%btO%ghO~O$T'kO~O$V'lO#h!QX#j!QX~O#xWi$fWi$hWi$SWi$VWi$]Wi#hWi#jWi~P4{O#xXi#yXi$fXi$hXi$SXi$VXi$]Xi#hXi#jXi~P5OO#xYi#yYi#zYi$fYi$hYi$SYi$VYi$]Yi#hYi#jYi~P5RO$O%SO$P%TO$Q%UO#xZi#yZi#zZi#{Zi#|Zi#}Zi$fZi$hZi$SZi$VZi$]Zi#hZi#jZi~O$O%SO$P%TO$Q%UO#x[i#y[i#z[i#{[i#|[i#}[i$f[i$h[i$S[i$V[i$][i#h[i#j[i~O$P%TO$Q%UO#x]i#y]i#z]i#{]i#|]i#}]i$O]i$f]i$h]i$S]i$V]i$]]i#h]i#j]i~O$Q%UO#x^i#y^i#z^i#{^i#|^i#}^i$O^i$P^i$f^i$h^i$S^i$V^i$]^i#h^i#j^i~O$h'oO~P8]O$T'qO~O$T'YO~O$V&uO$S$Wa~O$S'tO~O$V&yO$]$Ua$S$Ua~O$S'xO~O#hQO#j'zO~OUaO%[$RO~P$aOUaO#hQO#j'zO~P$aOUaO#h!gi#j!gi~P$aO$X&tO$SfX$VfX~O#h!Ty#j!Ty~P4xO$ZTO$gUO$j$jO#h%Oq#j%Oq~O!q&[O$T!fO~O$V'`O$S%na~O#hQO#j!SOU#Ya#]#Ya#n#Ya#o#Ya#r#Ya#t#Ya$Z#Ya$g#Ya$j#Ya$n#Ya$o#Ya$q#Ya$r#Ya$t#Ya$u#Ya$}#Ya%Y#Ya%[#Ya%]#Ya%^#Ya%_#Ya%`#Ya%a#Ya%b#Ya%g#Ya%p#Ya~O#hQO#j!SO$R$qO%p(UO~O#](YO~PIeO$S(ZO~O$V'lO#h!Qa#j!Qa~O$h(_O~O$V!ya$]!ya$S!ya~P4xO$h(_O~P8]O$h(aO~O$h(bO~P*pOUaO~P$aOUaO$h(gO%[$RO~P$aO#hQO#j(hO~O#hQO#j!SO%p(kO~O#hQO#j!SOU#Za#]#Za#n#Za#o#Za#r#Za#t#Za$Z#Za$g#Za$j#Za$n#Za$o#Za$q#Za$r#Za$t#Za$u#Za$}#Za%Y#Za%[#Za%]#Za%^#Za%_#Za%`#Za%a#Za%b#Za%g#Za#^#Za~O$h(mO~O$h(nO~P*pO#](pO#^(pO~PIeO$h(sO~P*pO#](tO#^(tO~PIeO#](vO#^(vO~PIeO$t~%l%g%p$}%Y#ew$u#h$v$w#u$YU$k#z%Q#n#y%W#d#i$e$d$T~",
  goto: "HQ%pP%qP%t&h'RP(S)V)V)V)V)V)V)V)V)o)oP)o*X+r,h,o-b/Y/dPP/j0YPP0Y0v0Y1g3b(SP4kP(S4r5j&h&h&h5y6P&h&h6Z6Z6^6^6d6{7P7W7_7i7l7v6d5j7|&h&h8P&hPPPP8Z8_8d8hP8n8r8_P8u9T9[:b:h:n:t:z;z<Q<W<c<r=U=[=n=t>W>^>dPPPPPPPPPPPPPPP>v>{?`PP?w@hPAdPPBi)oPPPPPPPPPPPPCyPDSPPPPP+rDWPPPPPPPPPDtPP?w?wPPPPPDzPPPPPPPP&hPEuE{PPFPF[FlPPPPFtPPPPPPPGTGWPGTPGZ8PGiGlPGqGwGzRwPQuOv!SXm!V#S#U$O$u$y%n&^'d'h'i'l'|(U(V(W(kQ'T%mS'z'U'WR(h(OjiOnu$t&_&b'j(T(i(j(q(r(ua#}!V$P'T'y'z(c(h(ojiOnu$t&_&b'j(T(i(j(q(r(uQ!}g`#}!V$P'T'y'z(c(h(oQ$p!|Q'U%mS'|'V'}Q(O'WQ(P'XR(d'{#RYO]agnu!Q!V!b!q!s!u!|#s#v$P$d$e$g$h$t%V%g%m&_&b&r'O'T'V'W'X'j'w'y'z'{'}(T(c(h(i(j(o(q(r(u}#d!P!T!m#e#h#o#p#{#|$]$}%O%P%Q%R%S%T%U%[%l%y&y}#n!P!T!m#e#h#o#p#{#|$]$}%O%P%Q%R%S%T%U%[%l%y&yQ!icQ#XpQ#YqQ#ZrQ#[s|#f!P!T!m#e#h#o#p#{#|$]$}%O%P%Q%R%S%T%U%[%l%y&yQ#w!RQ$^!jQ$_!lQ$o!{Q%v$YS&X$q'`S&f$y&hQ'c&[Q(['lR(l(]|#n!P!T!m#e#h#o#p#{#|$]$}%O%P%Q%R%S%T%U%[%l%y&yQ%v$YQ&c$wQ&d$xR&i$zS%Y#e%uR'r&u|#n!P!T!m#e#h#o#p#{#|$]$}%O%P%Q%R%S%T%U%[%l%y&yQ&c$wQ&d$xR&i$z#^VO]`agnu!O!Q!V!Y![!a!b!c!e!v!|#s#v$P$V$X$b$l$t%g%m%|&V&_&b&r'T'V'W'X'_'j'w'y'z'{'}(T(c(h(i(j(o(q(r(u|#g!P!T!m#e#h#o#p#{#|$]$}%O%P%Q%R%S%T%U%[%l%y&yV(w$w$x$zQ!OVQ#PhT%^#g(wX}Vh#g(w|#n!P!T!m#e#h#o#p#{#|$]$}%O%P%Q%R%S%T%U%[%l%y&yQ&c$wR&d$x!V#m!P!T!m#e#h#o#p#{#|$Y$]$w$x$z$}%O%P%Q%R%S%T%U%[%l%y&y!U#m!P!T!m#e#h#o#p#{#|$Y$]$w$x$z$}%O%P%Q%R%S%T%U%[%l%y&yR$z#[![bOgnu!V!|$P$t%m&_&b'T'V'W'X'j'y'z'{'}(T(c(h(i(j(o(q(r(uQ!Z]Q!``Q!daQ#b!OU#r!Q#v%gS$S!Y![Q$U!aU$W!b!c!eQ$m!vQ%f#sS%t$V$XS%}$b$lS'[%|&VQ'p&rQ(Q'_R(`'w#_WO]`agnu!O!Q!V!Y![!a!b!c!e!v!|#s#v$P$V$X$b$l$t%g%m%|&V&_&b&r'T'V'W'X'_'j'w'y'z'{'}(T(c(h(i(j(o(q(r(uS#t!Q#vR'P%g!k_O]`agnu!V!Y!b!c!|$P$V$t%m&_&b'T'V'W'X'j'y'z'{'}(T(c(h(i(j(o(q(r(ukiOnu$t&_&b'j(T(i(j(q(r(uQ&g$yR'n&hS&f$y&hQ(['lR(l(]R!jcQ$[!iR%x$^{fOnu!V$P$t&_&b'T'j'y'z(T(c(h(i(j(o(q(r(uT!wdeZ!nde!o!w$nZ!tde!o!w$nY!ude!o!w$nR$g!tR$f!sa$k!v$b$f$l%|&P&V'_Q$i!uR&R$gR!|ga$O!V$P'T'y'z(c(h(oT'|'V'}VkOnuT#Rj#TQ$s#RR(V'hT&^$t&_R'h&aQyQQ{SQ#WoV#^y{#WSnOuR#Vn![]Ognu!V!|$P$t%m&_&b'T'V'W'X'j'y'z'{'}(T(c(h(i(j(o(q(r(uY!X]!b#s&r'wQ!baU#s!Q#v%gQ&r%VR'w'OQ&z%_R'v&zQ&v%YR's&vQ%b#iR&|%bQ%h#tR'Q%h![`Ognu!V!|$P$t%m&_&b'T'V'W'X'j'y'z'{'}(T(c(h(i(j(o(q(r(uQ!Y]W!_`!Y!c$VQ!caR$V!bQ!^^R$T!^Q'm&fR(^'mS!odeS$a!o$nR$n!wQ$d!qQ$e!sS$h!u$gV&O$d$e$hQ$l!vQ%|$bQ&P$fW&U$l%|&P'_R'_&VQ&T$jR'^&TQ$P!VW%r$P'y(c(oQ'y'TQ(c'zR(o(hQ'}'VR(f'}Q!VXQ#UmW$Q!V#U'd(WQ'd&^R(W'iQ'a&YR(S'aQ&_$tR'e&_Q'j&bW(X'j(i(q(uQ(i(TQ(q(jR(u(rVmOnuUlOnuS&^$t&_a'i&b'j(T(i(j(q(r(u{SOnu!V$P$t&_&b'T'j'y'z(T(c(h(i(j(o(q(r(u!]bOgnu!V!|$P$t%m&_&b'T'V'W'X'j'y'z'{'}(T(c(h(i(j(o(q(r(u!s[O]agnu!Q!V!b!|#s#v$P$t%V%g%m&_&b&r'O'T'V'W'X'j'w'y'z'{'}(T(c(h(i(j(o(q(r(u!rZO]agnu!Q!V!b!|#s#v$P$t%V%g%m&_&b&r'O'T'V'W'X'j'w'y'z'{'}(T(c(h(i(j(o(q(r(u_$c!q!s!u$d$e$g$hQ#c!PQ#x!TQ$`!mQ%W#eU%_#h%[%lQ%d#oQ%e#pQ%o#{Q%p#|Q%w$]Q&j$}Q&k%OQ&l%PQ&m%QQ&n%RQ&o%SQ&p%TQ&q%UQ'Z%yR'u&yQ%`#hQ&x%[R'S%lT%Z#e%u!V#j!P!T!m#e#h#o#p#{#|$Y$]$w$x$z$}%O%P%Q%R%S%T%U%[%l%y&yQ#u!QR%j#v`!UXm!V#U&^'d'i(WQ$t#SQ%q$OQ&b$uQ&h$yQ'V%nQ(T'hQ(]'lQ(e'|S(j(U(VR(r(kQ!xdR!yeT!ldeS!vdeS$b!o!wR&V$nY!qde!o!w$n_$c!q!s!u$d$e$g$h]!sde!o!t!w$nkgOnu$t&_&b'j(T(i(j(q(r(uR#OgR!{g`#|!V$P'T'y'z(c(h(oT'{'V'}R#y!TVlOnuQ#SjR$u#TR&Z$qQ&Y$qR(R'`",
  nodeNames: "\u26A0 BlockComment Script LineComment AuthorWarning ContentLine Glue Conditional ExpressionAndOr ExpressionComparison ExpressionPresence ExpressionMod ExpressionAdd ExpressionSubtract ExpressionMultiply ExpressionDivide ExpressionParen ExpressionNot not ExpressionFunctionCall Name List ListMember ExpressionDivertTarget DivertArrow DivertTarget Path END DONE Stack Bool true false String Int Float Divert TunnelReturn InlineSequence SequenceTypeMarker SequenceContent Pipe InlineDisplayVariable Tag Include VariableDeclaration ConstDeclaration ListDeclaration ListDefinition SelectedName StackDeclaration VariableAssignment Temp Return Adjust IncDec OnceOnlyChoice BracketedChoiceName ChoiceCondition PreweaveChoiceContent WeaveBracket WeaveContent ChoiceTag PostweaveChoiceContent RepeatingChoice Gather BracketedGatherName ThreadLine BlockConditional BlockConditionCase BlockSequence stopping shuffle cycle once BlockSequenceItem Knot KnotName KnotArguments ref Stitch StitchName Function function",
  maxTerm: 216,
  context: trackKnotName,
  nodeProps: [
    ["group", -15, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 23, 29, "Expression", -4, 30, 33, 34, 35, "Expression Literal"]
  ],
  skippedNodes: [0, 1],
  repeatNodeCount: 20,
  tokenData: "#3}~R!dOX%aXY(bYZ(mZ]%a]^(m^p%apq(bqr(rrs,Rst-Wtu%auv-_vw.dwx%axy0nyz0}z{2S{|4f|}9U}!O:Z!O!PC`!P!QDe!Q![Gt![!]Kg!]!^%a!^!_Ll!_!`!!O!`!a!%i!a!b!&t!b!c%a!c!}!'y!}#O!,X#O#P!-U#P#Q!-u#Q#R!&t#R#T%a#T#U!.p#U#[!'y#[#]!5b#]#a!'y#a#b!@g#b#c!'y#c#d!GX#d#f!'y#f#g!Ii#g#h!'y#h#i#(y#i#o!'y#o#p#1u#p#q#2Q#q#r#2e#r#s#2p#s#t%a#t&j!'y&j)`!'y)`-x!'y-x4U%a4U7[!'y7[<v!'y<v=x%a=x?|!'y?|Bb!'yBbG|!'yG|;'S%a;'S;=`#3w<%lO%a<b%n[$kp%Q!b#n#x%W7[#iWOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d%[&k[%Q!b#n#xOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d#x'fY#n#xOX'aZ]'a^p'aqs'atx'ay#O'a#P#o'a#r;'S'a;'S;=`(U<%lO'a#x(XP;=`<%l'a%[(_P;=`<%l&d~(mO$kp%W7[#d~#iW~(rO#j~Gh)R`w#t$kp%Q!b#n#x%W7[#iWOX&dZ]&d^p&dqs&dtx&dy!_&d!_!`*T!`!a&d!a!b+S!b!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d0b*^[%Q!b#n#x#y,UOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d0b+][#z,U%Q!b#n#xOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d<r,b[$``$kp%Q!b#n#x%W7[#iWOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d9|-_O$j9t#iWGh-n[#{,U$kp%Q!b#n#x%W7[#iWOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&dGh.s^w#t$kp%Q!b#n#x%W7[#iWOX&dZ]&d^p&dqs&dtv&dvw/owx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d0b/x[#x,U%Q!b#n#xOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&dGx0}O$R,f$kp%Q!b#n#x%W7[#iWGx1^[$S,f$kp%Q!b#n#x%W7[#iWOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&dGh2e^$P,U$}S$kp%Q!b#n#x%W7[#iWOX&dZ]&d^p&dqs&dtx&dyz&dz{3a{!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d%[3j^$}S%Q!b#n#xOX&dZ]&d^p&dqs&dtx&dyz&dz{3a{!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&dMS4w`#},U%YS$kp%Q!b#n#x%W7[#iWOX&dZ]&d^p&dqs&dtx&dy{&d{|5y|!_&d!_!`8V!`!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d*v6U^$z&j%YS%Q!b#n#xOX&dZ]&d^p&dqs&dtx&dy{&d{|7Q|!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d%[7Z^%YS%Q!b#n#xOX&dZ]&d^p&dqs&dtx&dy{&d{|7Q|!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d*v8`[$x&j%Q!b#n#xOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&dGx9e[$V,f$kp%Q!b#n#x%W7[#iWOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&dMd:jh$O,U#u`$kp%Q!b#n#x#iWOX<UXZ=TZ]<U]^=T^p<Upq=Tqs<Ust=Ttx<Uxy=Ty}<U}!O=Y!O!_<U!_!`>Z!`!a?[!a!}<U!}#OBc#O#P=T#P#QBc#Q#o<U#o#r=T#r;'S<U;'S;=`CY<%lO<U;h<_[%X7[%Q!b#n#xOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d7[=YO%X7[AS=e[${&j%X7[%Q!b#n#xOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&dAS>f[$y&j%X7[%Q!b#n#xOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d<j?e^$Y<j%Q!b#n#xOX&dZ]&d^p&dqs&dtx&dy}&d}!O@a!O!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d<j@h^%Q!b#n#xOX&dZ]&d^p&dqs&dtx&dy!`&d!`!aAd!a!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d<jAm[$Y<j%Q!b#n#xOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d:UBjY%X7[#n#xOX'aZ]'a^p'aqs'atx'ay#O'a#P#o'a#r;'S'a;'S;=`(U<%lO'a;hC]P;=`<%l<UGxCo[$X,f$kp%Q!b#n#x%W7[#iWOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d~Dt`$Q,U$kp%Q!b#n#x%W7[#iWOX&dZ]&d^p&dqs&dtx&dyz&dz{Ev{!P&d!P!QFu!Q!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d~FP[#e~%Q!b#n#xOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&dGpGO[#hDz%Q!b#n#xOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d<rHT`$kp%Q!b#n#x%W7[#iW$d`OX&dZ]&d^p&dqs&dtx&dy!O&d!O!PIV!P!Q&d!Q![J[![!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d%lI`^%Q!b#n#x$e`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![IV![!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d%lJe`%Q!b#n#x$d`OX&dZ]&d^p&dqs&dtx&dy!O&d!O!PIV!P!Q&d!Q![J[![!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&dGxKv[$f,f$kp%Q!b#n#x%W7[#iWOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&dGhL{a$kp%Q!b#n#x#y,U%W7[#iWOX&dZ]&d^p&dqs&dtx&dy}&d}!ONQ!O!_&d!_!`*T!`!a! P!a!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d%[NZ[%gS%Q!b#n#xOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d%|! Y[Ut%Q!b#n#xOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&dMd!!a^$p&j%pd$kp%Q!b#n#x%W7[#iWOX&dZ]&d^p&dqs&dtx&dy!_&d!_!`!#]!`!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d0r!#h^%ld%Q!b#n#x#y,UOX&dZ]&d^p&dqs&dtx&dy!_&d!_!`!$d!`!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d%l!$m^%ld%Q!b#n#xOX&dZ]&d^p&dqs&dtx&dy!_&d!_!`!$d!`!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&dGh!%x^$kp%Q!b#n#x#y,U%W7[#iWOX&dZ]&d^p&dqs&dtx&dy!_&d!_!`*T!`!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&dGh!'T[$kp#z,U%Q!b#n#x%W7[#iWOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d<r!(Ym$kp%Q!b#n#x%W7[#iW$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d%l!*^m%Q!b#n#x$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d&f!,fY$[`$kp%Q!b#n#x#iWOX'aZ]'a^p'aqs'atx'ay#O'a#P#o'a#r;'S'a;'S;=`(U<%lO'a<b!-_R$kp%W7[#iWO;'S!-h;'S;=`!-m;=`O!-h%[!-mO#r%[%[!-rP#r%[;=`<%l!-hGx!.QY$]DU$kp#n#x#iWOX'aZ]'a^p'aqs'atx'ay#O'a#P#o'a#r;'S'a;'S;=`(U<%lO'aGx!/Po$kp%Q!b#n#x%W7[#iW$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#b!*T#b#c!1Q#c#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d0r!1Zo%Q!b#n#x$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#W!*T#W#X!3[#X#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d0r!3gm#x,U%Q!b#n#x$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&dGx!5qn$kp%Q!b#n#x%W7[#iW$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#U!7o#U#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d0r!7xo%Q!b#n#x$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#g!*T#g#h!9y#h#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d0r!:Uo#z,U%Q!b#n#x$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#b!*T#b#c!<V#c#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d0r!<`o%Q!b#n#x$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#h!*T#h#i!>a#i#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d0r!>lm#z,U%Q!b#n#x$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&dGx!@vo$kp%Q!b#n#x%W7[#iW$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#c!*T#c#d!Bw#d#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d0r!CQo%Q!b#n#x$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#W!*T#W#X!ER#X#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d0r!E^m#|,U%Q!b#n#x$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&dGx!Gho$kp%Q!b#n#x%W7[#iW$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#f!*T#f#g!3[#g#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d<r!Ixo$kp%Q!b#n#x%W7[#iW$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#X!*T#X#Y!Ky#Y#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d%l!LSo%Q!b#n#x$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#h!*T#h#i!NT#i#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d%l!N^o%Q!b#n#x$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#i!*T#i#j#!_#j#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d%l#!ho%Q!b#n#x$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#f!*T#f#g#$i#g#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d%l#$ro%Q!b#n#x$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#b!*T#b#c#&s#c#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d%l#'Om$w`%Q!b#n#x$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d<r#)Yo$kp%Q!b#n#x%W7[#iW$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#X!*T#X#Y#+Z#Y#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d%l#+do%Q!b#n#x$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#a!*T#a#b#-e#b#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d%l#-no%Q!b#n#x$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#d!*T#d#e#/o#e#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d%l#/zm$v`%Q!b#n#x$T`OX&dZ]&d^p&dqs&dtx&dy!Q&d!Q![!*T![!c&d!c!}!*T!}#O'a#P#Q'a#Q#R&d#R#S!*T#S#T&d#T#o!*T#r#t&d#t&j!*T&j)`!*T)`-x!*T-x4U&d4U7[!*T7[<v!*T<v=x&d=x?|!*T?|Bb!*TBbG|!*TG|;'S&d;'S;=`([<%lO&d<b#2QO#t%[$kp%W7[#iWFf#2]Py$Y$kp%W7[#iW#p#q#2`,U#2eO#x,UFf#2pO$h/`$kp%W7[#iW<b#3R[w#t$uS$kp%Q!b#n#x%W7[#iWOX&dZ]&d^p&dqs&dtx&dy!}&d!}#O'a#P#Q'a#Q#o&d#r;'S&d;'S;=`([<%lO&d<b#3zP;=`<%l%a",
  tokenizers: [endOfKnot, checkBrace, 2, 3, 4, 5, 6, 7, 8, 9, 10, new LocalTokenGroup("x~RQrsX#O#P^~^O$c~~aRO;'Sj;'S;=`o;=`Oj~oO$b~~tP$b~;=`<%lj~", 39, 155), new LocalTokenGroup("b~RPz{U~XP!P!Q[~aO#g~~", 17, 114)],
  topRules: { "Script": [0, 2] },
  dialects: { visualink: 2722 },
  dynamicPrecedences: { "50": 1, "121": 1, "185": 1, "190": 1, "195": 2, "204": 1, "208": 1 },
  specialized: [{ term: 122, get: (value) => spec_contentWord[value] || -1 }, { term: 143, get: (value) => spec_identifier[value] || -1 }, { term: 148, get: (value) => spec_arrowToken[value] || -1 }, { term: 186, get: (value) => spec_choiceContentWord[value] || -1 }],
  tokenPrec: 2724
});
var InkLanguage = import_language.LRLanguage.define({
  parser: parser.configure({
    props: [
      import_language.foldNodeProp.add({
        Knot: (tree, state) => ({ from: state.doc.lineAt(tree.from).to, to: state.doc.lineAt(tree.to - 1).to }),
        Function: (tree, state) => ({ from: state.doc.lineAt(tree.from).to, to: state.doc.lineAt(tree.to - 1).to }),
        Stitch: (tree, state) => ({ from: state.doc.lineAt(tree.from).to, to: state.doc.lineAt(tree.to - 1).to })
      }),
      styleTags({
        // Comments
        BlockComment: tags.blockComment,
        AuthorWarning: tags.comment,
        LineComment: tags.comment,
        // Plain content
        ContentLine: tags.content,
        PreweaveChoiceContent: tags.content,
        PostweaveChoiceContent: tags.content,
        WeaveContent: tags.content,
        SequenceContent: tags.content,
        // Keywords
        Include: tags.keyword,
        END: tags.keyword,
        DONE: tags.keyword,
        VariableDeclaration: tags.keyword,
        ConstDeclaration: tags.keyword,
        ListDeclaration: tags.keyword,
        _function: tags.keyword,
        Temp: tags.keyword,
        Return: tags.keyword,
        ref: tags.keyword,
        stopping: tags.keyword,
        shuffle: tags.keyword,
        cycle: tags.keyword,
        once: tags.keyword,
        not: tags.keyword,
        ListDefinition: tags.keyword,
        StackDeclaration: tags.keyword,
        VariableAssignment: tags.operatorKeyword,
        SequenceTypeMarker: tags.operatorKeyword,
        // Literal values
        Name: tags.name,
        StitchName: tags.name,
        KnotName: tags.name,
        ListMember: tags.literal,
        Path: tags.name,
        SelectedName: tags.literal,
        Bool: tags.bool,
        _true: tags.bool,
        _false: tags.bool,
        Int: tags.number,
        Float: tags.number,
        String: tags.string,
        // Tags
        Tag: tags.labelName,
        ChoiceTag: tags.labelName,
        // Brackets
        Stack: tags.list,
        List: tags.list,
        KnotArguments: tags.bracket,
        WeaveBracket: tags.squareBracket,
        BlockConditional: tags.brace,
        Conditional: tags.brace,
        InlineSequence: tags.brace,
        InlineDisplayVariable: tags.brace,
        BlockSequence: tags.brace,
        BracketedChoiceName: tags.paren,
        BracketedGatherName: tags.paren,
        // Special operators
        Glue: tags.operator,
        Pipe: tags.separator,
        Gather: tags.controlOperator,
        DivertArrow: tags.controlOperator,
        TunnelReturn: tags.controlOperator,
        OnceOnlyChoice: tags.controlOperator,
        RepeatingChoice: tags.controlOperator,
        ChoiceCondition: tags.controlOperator,
        BlockConditionCase: tags.controlOperator,
        BlockSequenceItem: tags.controlOperator,
        // Sections
        Knot: tags.heading1,
        Function: tags.heading1,
        Stitch: tags.heading2,
        // Standard operators
        Adjust: tags.operator,
        IncDec: tags.operator,
        ExpressionAndOr: tags.logicOperator,
        ExpressionComparison: tags.compareOperator,
        ExpressionPresence: tags.compareOperator,
        ExpressionMod: tags.arithmeticOperator,
        ExpressionAdd: tags.arithmeticOperator,
        ExpressionSubstract: tags.arithmeticOperator,
        ExpressionMultiply: tags.arithmeticOperator,
        ExpressionDivide: tags.arithmeticOperator,
        ExpressionNot: tags.logicOperator,
        "=": tags.operator
      })
    ]
  }),
  languageData: { commentTokens: { line: "//", block: { open: "/*", close: "*/" } } }
});
var InkLanguageSupport = (config = {}) => {
  const configured = InkLanguage.configure(config);
  return new import_language.LanguageSupport(configured);
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InkLanguage,
  InkLanguageSupport
});
