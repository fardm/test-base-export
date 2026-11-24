/* Bases to HTML - Type-Aware Interactive Engine */
(function() {
  'use strict';

  var dataEl = document.getElementById('base-data');
  if (!dataEl) return;

  var baseData;
  try {
    baseData = JSON.parse(dataEl.textContent || '{}');
  } catch (e) {
    console.error('Failed to parse base-data JSON:', e);
    return;
  }

  var base = baseData.base;
  var items = baseData.items;
  var exportScope = baseData.exportScope || 'full';
  if (!base || !items) return;

  var storagePrefix = 'b2h_' + (base.title || 'default') + '_';

  // Global settings state
  var currentTheme = localStorage.getItem('b2h_theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  var currentWidth = localStorage.getItem('b2h_width') || 'normal';
  var currentFont = localStorage.getItem('b2h_font') || 'vazirmatn';

  // Base state
  var currentViewIdx = 0;
  var savedViewIdx = localStorage.getItem(storagePrefix + 'view_idx');
  if (savedViewIdx !== null && !isNaN(Number(savedViewIdx)) && Number(savedViewIdx) < base.views.length) {
    currentViewIdx = Number(savedViewIdx);
  }

  var searchQuery = '';
  var activeFilterRules = [];
  var activeSortRules = [];
  var activeGroupRule = null;
  var activeOrder = [];

  // Property types dictionary from export
  var propertyTypes = base.propertyTypes || {};

  // Standard operators by type
  var OPERATORS_BY_TYPE = {
    text: [
      { id: 'contains', label: 'contains' },
      { id: 'does_not_contain', label: 'does not contain' },
      { id: 'is', label: 'is exactly' },
      { id: 'is_not', label: 'is not exactly' },
      { id: 'is_empty', label: 'is empty', noValue: true },
      { id: 'is_not_empty', label: 'is not empty', noValue: true }
    ],
    number: [
      { id: '=', label: '=' },
      { id: '!=', label: '≠' },
      { id: '>', label: '>' },
      { id: '<', label: '<' },
      { id: '>=', label: '≥' },
      { id: '<=', label: '≤' },
      { id: 'is_empty', label: 'is empty', noValue: true },
      { id: 'is_not_empty', label: 'is not empty', noValue: true }
    ],
    date: [
      { id: 'is', label: 'is' },
      { id: 'is_before', label: 'is before' },
      { id: 'is_after', label: 'is after' },
      { id: 'is_on_or_before', label: 'is on or before' },
      { id: 'is_on_or_after', label: 'is on or after' },
      { id: 'is_empty', label: 'is empty', noValue: true },
      { id: 'is_not_empty', label: 'is not empty', noValue: true }
    ],
    checkbox: [
      { id: 'is_checked', label: 'is checked', noValue: true },
      { id: 'is_not_checked', label: 'is not checked', noValue: true }
    ],
    list: [
      { id: 'contains', label: 'contains' },
      { id: 'has_tag', label: 'has tag' },
      { id: 'contains_any', label: 'contains any of' },
      { id: 'contains_all', label: 'contains all of' },
      { id: 'does_not_contain', label: 'does not contain' },
      { id: 'does_not_contain_any', label: 'does not contain any of' },
      { id: 'is_empty', label: 'is empty', noValue: true },
      { id: 'is_not_empty', label: 'is not empty', noValue: true }
    ],
    link: [
      { id: 'is', label: 'is' },
      { id: 'is_not', label: 'is not' },
      { id: 'contains', label: 'contains' },
      { id: 'is_empty', label: 'is empty', noValue: true },
      { id: 'is_not_empty', label: 'is not empty', noValue: true }
    ]
  };

  // Helper to create Lucide SVG element referencing <defs>
  function createIconSvg(name, extraClass) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', extraClass ? 'b2h-icon ' + extraClass : 'b2h-icon');
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#lucide-' + name);
    svg.appendChild(use);
    return svg;
  }

  // DOM Elements
  var htmlRoot = document.documentElement;
  var viewSelect = document.getElementById('viewSelect');
  var searchInput = document.getElementById('searchInput');
  var searchClearBtn = document.getElementById('searchClearBtn');

  // Popover Buttons & Elements
  var sortToggleBtn = document.getElementById('sortToggleBtn');
  var sortPopover = document.getElementById('sortPopover');
  var sortRulesList = document.getElementById('sortRulesList');
  var addSortBtn = document.getElementById('addSortBtn');
  var sortCountBadge = document.getElementById('sortCountBadge');

  var groupToggleBtn = document.getElementById('groupToggleBtn');
  var groupPopover = document.getElementById('groupPopover');
  var groupRulesList = document.getElementById('groupRulesList');
  var addGroupBtn = document.getElementById('addGroupBtn');

  var filterToggleBtn = document.getElementById('filterToggleBtn');
  var filterPopover = document.getElementById('filterPopover');
  var filterRulesList = document.getElementById('filterRulesList');
  var addFilterBtn = document.getElementById('addFilterBtn');
  var filterCountBadge = document.getElementById('filterCountBadge');

  var propertiesToggleBtn = document.getElementById('propertiesToggleBtn');
  var propertiesPopover = document.getElementById('propertiesPopover');
  var propertiesList = document.getElementById('propertiesList');

  var contentContainer = document.getElementById('contentContainer');
  var itemCountBadge = document.getElementById('itemCountBadge');

  // Settings Drawer Elements
  var settingsBtn = document.getElementById('settingsBtn');
  var settingsDrawer = document.getElementById('settingsDrawer');
  var drawerCloseBtn = document.getElementById('drawerCloseBtn');
  var modalOverlay = document.getElementById('modalOverlay');
  var themeLightBtn = document.getElementById('themeLightBtn');
  var themeDarkBtn = document.getElementById('themeDarkBtn');
  var widthFullBtn = document.getElementById('widthFullBtn');
  var widthNormalBtn = document.getElementById('widthNormalBtn');
  var widthNarrowBtn = document.getElementById('widthNarrowBtn');
  var fontSelect = document.getElementById('fontSelect');

  // Note Modal Elements
  var noteModal = document.getElementById('noteModal');
  var modalTitle = document.getElementById('modalTitle');
  var modalCloseBtn = document.getElementById('modalCloseBtn');
  var modalProperties = document.getElementById('modalProperties');
  var modalMarkdownContent = document.getElementById('modalMarkdownContent');

  // Initialize Global Preferences
  applyTheme(currentTheme);
  applyWidth(currentWidth);
  applyFont(currentFont);

  // Initialize View
  initView(currentViewIdx);

  // Setup Popovers toggling
  setupPopoverToggles();

  // Search input events
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      searchQuery = e.target.value.trim().toLowerCase();
      if (searchClearBtn) {
        if (searchQuery) searchClearBtn.classList.add('visible');
        else searchClearBtn.classList.remove('visible');
      }
      renderCards();
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', function() {
      searchInput.value = '';
      searchQuery = '';
      searchClearBtn.classList.remove('visible');
      renderCards();
    });
  }

  if (viewSelect) {
    viewSelect.addEventListener('change', function(e) {
      currentViewIdx = Number(e.target.value);
      localStorage.setItem(storagePrefix + 'view_idx', String(currentViewIdx));
      initView(currentViewIdx);
    });
  }

  // Settings Handlers
  if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
  if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeSettings);
  if (modalOverlay) {
    modalOverlay.addEventListener('click', function() {
      closeSettings();
      closeNoteModal();
      closeAllPopovers();
    });
  }
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeNoteModal);

  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeSettings();
      closeNoteModal();
      closeAllPopovers();
    }
  });

  if (themeLightBtn) themeLightBtn.addEventListener('click', function() { applyTheme('light'); });
  if (themeDarkBtn) themeDarkBtn.addEventListener('click', function() { applyTheme('dark'); });
  if (widthFullBtn) widthFullBtn.addEventListener('click', function() { applyWidth('full'); });
  if (widthNormalBtn) widthNormalBtn.addEventListener('click', function() { applyWidth('normal'); });
  if (widthNarrowBtn) widthNarrowBtn.addEventListener('click', function() { applyWidth('narrow'); });
  if (fontSelect) {
    fontSelect.addEventListener('change', function(e) { applyFont(e.target.value); });
  }

  // =========================================================================
  // Popover Handlers
  // =========================================================================

  function setupPopoverToggles() {
    var popoverPairs = [
      { btn: sortToggleBtn, popover: sortPopover },
      { btn: groupToggleBtn, popover: groupPopover },
      { btn: filterToggleBtn, popover: filterPopover },
      { btn: propertiesToggleBtn, popover: propertiesPopover }
    ];

    popoverPairs.forEach(function(pair) {
      if (!pair.btn || !pair.popover) return;
      pair.btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var wasOpen = pair.popover.classList.contains('open');
        closeAllPopovers();
        if (!wasOpen) {
          pair.popover.classList.add('open');
          pair.btn.classList.add('active');
        }
      });

      pair.popover.addEventListener('click', function(e) {
        e.stopPropagation();
      });
    });

    document.addEventListener('click', function() {
      closeAllPopovers();
    });

    if (addSortBtn) {
      addSortBtn.addEventListener('click', function() {
        var allProps = getAllAvailablePropertyKeys();
        var defaultProp = allProps[0] || 'file.name';
        activeSortRules.push({ property: defaultProp, direction: 'DESC' });
        saveSortState();
        renderSortPopover();
        renderCards();
      });
    }

    if (addGroupBtn) {
      addGroupBtn.addEventListener('click', function() {
        var allProps = getAllAvailablePropertyKeys();
        var defaultProp = allProps[0] || 'rating';
        activeGroupRule = { property: defaultProp, direction: 'DESC' };
        saveGroupState();
        renderGroupPopover();
        renderCards();
      });
    }

    if (addFilterBtn) {
      addFilterBtn.addEventListener('click', function() {
        var allProps = getAllAvailablePropertyKeys();
        var defaultProp = allProps[0] || 'file.name';
        var pType = getPropertyType(defaultProp);
        var opList = OPERATORS_BY_TYPE[pType] || OPERATORS_BY_TYPE.text;
        var defaultOp = opList[0] ? opList[0].id : 'contains';
        activeFilterRules.push({
          conjunction: activeFilterRules.length === 0 ? 'where' : 'and',
          property: defaultProp,
          operator: defaultOp,
          value: ''
        });
        saveFilterState();
        renderFilterPopover();
        renderCards();
      });
    }
  }

  function closeAllPopovers() {
    [sortPopover, groupPopover, filterPopover, propertiesPopover].forEach(function(pop) {
      if (pop) pop.classList.remove('open');
    });
    updateToolbarActiveStates();
  }

  function updateToolbarActiveStates() {
    if (sortToggleBtn) {
      var isSortOpen = sortPopover && sortPopover.classList.contains('open');
      var hasSorts = activeSortRules.length > 0;
      sortToggleBtn.classList.toggle('active', isSortOpen || hasSorts);
      if (sortCountBadge) {
        if (hasSorts) {
          sortCountBadge.textContent = String(activeSortRules.length);
          sortCountBadge.style.display = 'inline-block';
        } else {
          sortCountBadge.style.display = 'none';
        }
      }
    }

    if (groupToggleBtn) {
      var isGroupOpen = groupPopover && groupPopover.classList.contains('open');
      var hasGroup = Boolean(activeGroupRule && activeGroupRule.property);
      groupToggleBtn.classList.toggle('active', isGroupOpen || hasGroup);
    }

    if (filterToggleBtn) {
      var isFilterOpen = filterPopover && filterPopover.classList.contains('open');
      var hasFilters = activeFilterRules.length > 0;
      filterToggleBtn.classList.toggle('active', isFilterOpen || hasFilters);
      if (filterCountBadge) {
        if (hasFilters) {
          filterCountBadge.textContent = String(activeFilterRules.length);
          filterCountBadge.style.display = 'inline-block';
        } else {
          filterCountBadge.style.display = 'none';
        }
      }
    }

    if (propertiesToggleBtn) {
      var isPropsOpen = propertiesPopover && propertiesPopover.classList.contains('open');
      propertiesToggleBtn.classList.toggle('active', isPropsOpen);
    }
  }

  // =========================================================================
  // View Initialization & LocalStorage
  // =========================================================================

  function initView(viewIdx) {
    var view = base.views[viewIdx];
    if (!view) return;

    currentViewIdx = viewIdx;
    if (viewSelect) viewSelect.value = String(viewIdx);

    // Update main container attributes for CSS targeting
    var mainEl = document.querySelector('main.main-content');
    if (mainEl && view) {
      mainEl.setAttribute('data-view-id', view.id || ('view-' + viewIdx));
      mainEl.setAttribute('data-view-name', view.name || ('View ' + (viewIdx + 1)));
      mainEl.setAttribute('data-view-type', view.type || 'cards');
    }

    var cardSize = view.cardSize || 180;
    var rawRatio = typeof view.imageAspectRatio === 'number' && view.imageAspectRatio > 0 ? view.imageAspectRatio : 1.5;
    var cssRatio = 1 / rawRatio;
    var imageFit = view.imageFit || 'cover';

    htmlRoot.style.setProperty('--card-size', cardSize + 'px');
    htmlRoot.style.setProperty('--aspect-ratio', String(rawRatio));
    htmlRoot.style.setProperty('--css-aspect-ratio', String(cssRatio));
    htmlRoot.style.setProperty('--image-fit', imageFit);

    var viewKey = view.id ? ('v_' + view.id) : ('view_' + viewIdx);

    // 1. Sort state
    var savedSorts = localStorage.getItem(storagePrefix + viewKey + '_sorts');
    if (savedSorts) {
      try { activeSortRules = JSON.parse(savedSorts) || []; } catch (e) { activeSortRules = []; }
    } else if (Array.isArray(view.sort) && view.sort.length > 0) {
      activeSortRules = view.sort.map(function(s) {
        return { property: s.property, direction: (s.direction || 'DESC').toUpperCase() };
      });
    } else {
      activeSortRules = [];
    }

    // 2. Group state
    var savedGroup = localStorage.getItem(storagePrefix + viewKey + '_group');
    if (savedGroup) {
      try { activeGroupRule = JSON.parse(savedGroup); } catch (e) { activeGroupRule = null; }
    } else if (view.groupBy && view.groupBy.property) {
      activeGroupRule = { property: view.groupBy.property, direction: (view.groupBy.direction || 'DESC').toUpperCase() };
    } else {
      activeGroupRule = null;
    }

    // 3. Filter state
    var savedFilters = localStorage.getItem(storagePrefix + viewKey + '_filters');
    if (savedFilters) {
      try { activeFilterRules = JSON.parse(savedFilters) || []; } catch (e) { activeFilterRules = []; }
    } else {
      activeFilterRules = parseInitialViewFilters(view.filters);
    }

    // 4. Properties order state
    var savedOrder = localStorage.getItem(storagePrefix + viewKey + '_order');
    if (savedOrder) {
      try { activeOrder = JSON.parse(savedOrder) || []; } catch (e) { activeOrder = []; }
    } else if (Array.isArray(view.order) && view.order.length > 0) {
      activeOrder = view.order.slice();
    } else if (view.type === 'table') {
      activeOrder = getAllAvailablePropertyKeys();
    } else {
      activeOrder = ['file.name', 'rating'];
    }

    if (propertiesToggleBtn) {
      var propSpan = propertiesToggleBtn.querySelector('span');
      if (propSpan) {
        propSpan.textContent = view.type === 'table' ? 'Columns' : 'Properties';
      }
    }
    var propPopoverHeader = document.querySelector('#propertiesPopover .popover-header');
    if (propPopoverHeader) {
      propPopoverHeader.textContent = view.type === 'table' ? 'Table columns' : 'Card properties';
    }

    searchQuery = '';
    if (searchInput) searchInput.value = '';

    renderSortPopover();
    renderGroupPopover();
    renderFilterPopover();
    renderPropertiesPopover();
    renderCards();
    updateToolbarActiveStates();
  }

  function parseInitialViewFilters(filters) {
    var rules = [];
    if (!filters) return rules;

    function parseItem(item) {
      if (typeof item === 'string') {
        var str = item.trim();
        var tagMatch = str.match(/^file\.hasTag\(["']?(.*?)["']?\)$/);
        if (tagMatch) {
          rules.push({
            conjunction: rules.length === 0 ? 'where' : 'and',
            property: 'file.tags',
            operator: 'has_tag',
            value: tagMatch[1].replace(/^#/, '')
          });
          return;
        }

        var contMatch = str.match(/^([\w.-]+)\.contains\(["']?(.*?)["']?\)$/);
        if (contMatch) {
          var contProp = contMatch[1];
          var contVal = contMatch[2];
          var isTag = contProp === 'file.tags' || contProp === 'tags' || contProp.toLowerCase().indexOf('tag') !== -1;
          rules.push({
            conjunction: rules.length === 0 ? 'where' : 'and',
            property: isTag ? 'file.tags' : contProp,
            operator: isTag ? 'has_tag' : 'contains',
            value: isTag ? contVal.replace(/^#/, '') : contVal
          });
          return;
        }

        var ops = ['!=', '==', '>=', '<=', '>', '<'];
        for (var i = 0; i < ops.length; i++) {
          var op = ops[i];
          var parts = str.split(op);
          if (parts.length === 2) {
            var pName = parts[0].trim();
            var rawVal = parts[1].trim().replace(/^["']/, '').replace(/["']$/, '');
            var val = !isNaN(Number(rawVal)) ? Number(rawVal) : rawVal;
            var mappedOp = op === '==' ? '=' : (op === '!=' ? '!=' : op);
            rules.push({
              conjunction: rules.length === 0 ? 'where' : 'and',
              property: pName,
              operator: mappedOp,
              value: val
            });
            return;
          }
        }
      } else if (Array.isArray(item)) {
        item.forEach(parseItem);
      } else if (typeof item === 'object' && item !== null) {
        if (Array.isArray(item.and)) item.and.forEach(parseItem);
        if (Array.isArray(item.or)) item.or.forEach(parseItem);
      }
    }

    parseItem(filters);
    return rules;
  }

  function getViewStorageKey() {
    var view = base.views[currentViewIdx];
    return view && view.id ? ('v_' + view.id) : ('view_' + currentViewIdx);
  }

  function saveSortState() {
    localStorage.setItem(storagePrefix + getViewStorageKey() + '_sorts', JSON.stringify(activeSortRules));
    updateToolbarActiveStates();
  }

  function saveGroupState() {
    localStorage.setItem(storagePrefix + getViewStorageKey() + '_group', JSON.stringify(activeGroupRule));
    updateToolbarActiveStates();
  }

  function saveFilterState() {
    localStorage.setItem(storagePrefix + getViewStorageKey() + '_filters', JSON.stringify(activeFilterRules));
    updateToolbarActiveStates();
  }

  function saveOrderState() {
    localStorage.setItem(storagePrefix + getViewStorageKey() + '_order', JSON.stringify(activeOrder));
  }

  // =========================================================================
  // Property Helpers & Types
  // =========================================================================

  function getAllAvailablePropertyKeys() {
    var set = new Set();
    set.add('file.name');
    set.add('file.tags');

    Object.keys(propertyTypes).forEach(function(k) {
      set.add(k);
    });

    items.forEach(function(it) {
      if (it.properties) {
        Object.keys(it.properties).forEach(function(k) { set.add(k); });
      }
      if (it.computedFormulas) {
        Object.keys(it.computedFormulas).forEach(function(k) { set.add('formula.' + k); });
      }
    });

    return Array.from(set);
  }

  function getPropertyMetadata(propName) {
    if (propertyTypes[propName]) return propertyTypes[propName];

    var type = 'text';
    var icon = 'type';

    if (propName === 'rating' || propName.toLowerCase().includes('score') || propName === 'pages' || propName === 'year') {
      type = 'number';
      icon = 'hash';
    } else if (propName === 'date' || propName.toLowerCase().includes('date')) {
      type = 'date';
      icon = 'calendar';
    } else if (propName === 'badge' || propName === 'tags' || propName === 'file.tags') {
      type = 'list';
      icon = 'tag';
    } else if (propName === 'file' || propName === 'file.name') {
      type = 'text';
      icon = 'file-text';
    } else if (propName.startsWith('formula.')) {
      type = 'text';
      icon = 'calculator';
    }

    return { id: propName, name: propName, type: type, icon: icon };
  }

  function getPropertyType(propName) {
    return getPropertyMetadata(propName).type;
  }

  function getDirectionLabels(propName) {
    var type = getPropertyType(propName);
    if (type === 'number') {
      return { asc: '0 → 1', desc: '1 → 0' };
    }
    if (type === 'date') {
      return { asc: 'Oldest → Newest', desc: 'Newest → Oldest' };
    }
    return { asc: 'A → Z', desc: 'Z → A' };
  }

  function getItemValue(item, propPath) {
    if (!propPath) return undefined;
    var clean = propPath.trim();
    if (clean === 'file.name' || clean === 'name' || clean === 'file') return item.title;
    if (clean === 'file.path') return item.path;
    if (clean === 'file.tags' || clean === 'tags' || clean === 'file.tag') {
      if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) return item.tags;
      if (item.properties && item.properties.tags) {
        return Array.isArray(item.properties.tags) ? item.properties.tags : [item.properties.tags];
      }
      return [];
    }
    if (clean.startsWith('formula.')) {
      var fName = clean.slice('formula.'.length);
      return item.computedFormulas ? item.computedFormulas[fName] : undefined;
    }
    if (clean.startsWith('note.')) {
      var p = clean.slice('note.'.length);
      return item.properties ? item.properties[p] : undefined;
    }
    if (item.properties && clean in item.properties) {
      return item.properties[clean];
    }
    if (item.computedFormulas && clean in item.computedFormulas) {
      return item.computedFormulas[clean];
    }
    return undefined;
  }

  // =========================================================================
  // Popover Renders (Sort, Group, Filter, Properties)
  // =========================================================================

  function renderSortPopover() {
    if (!sortRulesList) return;
    sortRulesList.innerHTML = '';

    var allProps = getAllAvailablePropertyKeys();

    activeSortRules.forEach(function(rule, idx) {
      var row = document.createElement('div');
      row.className = 'popover-rule-row';
      row.setAttribute('draggable', 'true');

      // Drag Handle with Lucide grip icon
      var dragHandle = document.createElement('span');
      dragHandle.className = 'drag-handle';
      dragHandle.title = 'Drag to reorder';
      dragHandle.appendChild(createIconSvg('grip-vertical', 'b2h-icon-drag'));
      row.appendChild(dragHandle);

      // Pill container
      var pill = document.createElement('div');
      pill.className = 'popover-rule-pill';

      // Property Icon
      var meta = getPropertyMetadata(rule.property);
      var propIconSpan = document.createElement('span');
      propIconSpan.className = 'pill-icon';
      propIconSpan.appendChild(createIconSvg(meta.icon || 'type', 'b2h-icon-xs'));
      pill.appendChild(propIconSpan);

      // Property Select
      var propSelect = document.createElement('select');
      propSelect.className = 'pill-select';
      allProps.forEach(function(p) {
        var m = getPropertyMetadata(p);
        var opt = document.createElement('option');
        opt.value = p;
        opt.textContent = m.name;
        if (p === rule.property) opt.selected = true;
        propSelect.appendChild(opt);
      });

      propSelect.addEventListener('change', function(e) {
        rule.property = e.target.value;
        saveSortState();
        renderSortPopover();
        renderCards();
      });
      pill.appendChild(propSelect);

      var divider = document.createElement('span');
      divider.className = 'pill-divider';
      pill.appendChild(divider);

      // Direction Select
      var dirSelect = document.createElement('select');
      dirSelect.className = 'pill-select';
      var dirLabels = getDirectionLabels(rule.property);

      var optDesc = document.createElement('option');
      optDesc.value = 'DESC';
      optDesc.textContent = dirLabels.desc + ' ↕';
      if (rule.direction === 'DESC') optDesc.selected = true;
      dirSelect.appendChild(optDesc);

      var optAsc = document.createElement('option');
      optAsc.value = 'ASC';
      optAsc.textContent = dirLabels.asc + ' ↕';
      if (rule.direction === 'ASC') optAsc.selected = true;
      dirSelect.appendChild(optAsc);

      dirSelect.addEventListener('change', function(e) {
        rule.direction = e.target.value;
        saveSortState();
        renderCards();
      });
      pill.appendChild(dirSelect);

      row.appendChild(pill);

      // Delete Button with Lucide trash icon
      var delBtn = document.createElement('button');
      delBtn.className = 'popover-rule-delete';
      delBtn.title = 'Remove sort rule';
      delBtn.appendChild(createIconSvg('trash', 'b2h-icon-sm'));
      delBtn.addEventListener('click', function() {
        activeSortRules.splice(idx, 1);
        saveSortState();
        renderSortPopover();
        renderCards();
      });
      row.appendChild(delBtn);

      // Drag and Drop
      setupDragDrop(row, idx, activeSortRules, function() {
        saveSortState();
        renderSortPopover();
        renderCards();
      });

      sortRulesList.appendChild(row);
    });

    updateToolbarActiveStates();
  }

  function renderGroupPopover() {
    if (!groupRulesList) return;
    groupRulesList.innerHTML = '';

    if (!activeGroupRule || !activeGroupRule.property) {
      var emptyMsg = document.createElement('p');
      emptyMsg.style.fontSize = '0.85rem';
      emptyMsg.style.color = 'var(--text-muted)';
      emptyMsg.style.margin = '0.25rem 0';
      emptyMsg.textContent = 'No active grouping.';
      groupRulesList.appendChild(emptyMsg);
      if (addGroupBtn) addGroupBtn.style.display = 'inline-flex';
      updateToolbarActiveStates();
      return;
    }

    if (addGroupBtn) addGroupBtn.style.display = 'none';

    var allProps = getAllAvailablePropertyKeys();
    var row = document.createElement('div');
    row.className = 'popover-rule-row';

    var pill = document.createElement('div');
    pill.className = 'popover-rule-pill';

    // Property Icon
    var meta = getPropertyMetadata(activeGroupRule.property);
    var propIconSpan = document.createElement('span');
    propIconSpan.className = 'pill-icon';
    propIconSpan.appendChild(createIconSvg(meta.icon || 'type', 'b2h-icon-xs'));
    pill.appendChild(propIconSpan);

    // Property Select
    var propSelect = document.createElement('select');
    propSelect.className = 'pill-select';
    allProps.forEach(function(p) {
      var m = getPropertyMetadata(p);
      var opt = document.createElement('option');
      opt.value = p;
      opt.textContent = m.name;
      if (p === activeGroupRule.property) opt.selected = true;
      propSelect.appendChild(opt);
    });

    propSelect.addEventListener('change', function(e) {
      activeGroupRule.property = e.target.value;
      saveGroupState();
      renderGroupPopover();
      renderCards();
    });
    pill.appendChild(propSelect);

    var divider = document.createElement('span');
    divider.className = 'pill-divider';
    pill.appendChild(divider);

    // Direction Select
    var dirSelect = document.createElement('select');
    dirSelect.className = 'pill-select';
    var dirLabels = getDirectionLabels(activeGroupRule.property);

    var optDesc = document.createElement('option');
    optDesc.value = 'DESC';
    optDesc.textContent = dirLabels.desc + ' ↕';
    if (activeGroupRule.direction === 'DESC') optDesc.selected = true;
    dirSelect.appendChild(optDesc);

    var optAsc = document.createElement('option');
    optAsc.value = 'ASC';
    optAsc.textContent = dirLabels.asc + ' ↕';
    if (activeGroupRule.direction === 'ASC') optAsc.selected = true;
    dirSelect.appendChild(optAsc);

    dirSelect.addEventListener('change', function(e) {
      activeGroupRule.direction = e.target.value;
      saveGroupState();
      renderCards();
    });
    pill.appendChild(dirSelect);

    row.appendChild(pill);

    // Delete Button (Remove grouping) with Lucide trash icon
    var delBtn = document.createElement('button');
    delBtn.className = 'popover-rule-delete';
    delBtn.title = 'Remove grouping';
    delBtn.appendChild(createIconSvg('trash', 'b2h-icon-sm'));
    delBtn.addEventListener('click', function() {
      activeGroupRule = null;
      saveGroupState();
      renderGroupPopover();
      renderCards();
    });
    row.appendChild(delBtn);

    groupRulesList.appendChild(row);
    updateToolbarActiveStates();
  }

  function renderFilterPopover() {
    if (!filterRulesList) return;
    filterRulesList.innerHTML = '';

    var allProps = getAllAvailablePropertyKeys();

    activeFilterRules.forEach(function(rule, idx) {
      var row = document.createElement('div');
      row.className = 'popover-rule-row';
      row.setAttribute('draggable', 'true');

      // Prefix button (where for row 0, and/or toggle for row > 0)
      if (idx === 0) {
        var whereLabel = document.createElement('span');
        whereLabel.className = 'filter-conjunction-btn';
        whereLabel.textContent = 'where';
        whereLabel.style.cursor = 'default';
        row.appendChild(whereLabel);
      } else {
        var conjBtn = document.createElement('button');
        conjBtn.className = 'filter-conjunction-btn';
        conjBtn.textContent = rule.conjunction || 'and';
        conjBtn.title = 'Toggle AND / OR';
        conjBtn.addEventListener('click', function() {
          rule.conjunction = (rule.conjunction === 'or') ? 'and' : 'or';
          conjBtn.textContent = rule.conjunction;
          saveFilterState();
          renderCards();
        });
        row.appendChild(conjBtn);
      }

      // Pill container
      var pill = document.createElement('div');
      pill.className = 'popover-rule-pill';

      // Property Icon
      var meta = getPropertyMetadata(rule.property);
      var propIconSpan = document.createElement('span');
      propIconSpan.className = 'pill-icon';
      propIconSpan.appendChild(createIconSvg(meta.icon || 'type', 'b2h-icon-xs'));
      pill.appendChild(propIconSpan);

      // 1. Property Select
      var propSelect = document.createElement('select');
      propSelect.className = 'pill-select';
      allProps.forEach(function(p) {
        var m = getPropertyMetadata(p);
        var opt = document.createElement('option');
        opt.value = p;
        opt.textContent = m.name;
        if (p === rule.property) opt.selected = true;
        propSelect.appendChild(opt);
      });

      propSelect.addEventListener('change', function(e) {
        rule.property = e.target.value;
        var pType = getPropertyType(rule.property);
        var opList = OPERATORS_BY_TYPE[pType] || OPERATORS_BY_TYPE.text;
        rule.operator = opList[0] ? opList[0].id : 'contains';
        rule.value = '';
        saveFilterState();
        renderFilterPopover();
        renderCards();
      });
      pill.appendChild(propSelect);

      var divider1 = document.createElement('span');
      divider1.className = 'pill-divider';
      pill.appendChild(divider1);

      // 2. Operator Select
      var pType = getPropertyType(rule.property);
      var opList = OPERATORS_BY_TYPE[pType] || OPERATORS_BY_TYPE.text;

      var opSelect = document.createElement('select');
      opSelect.className = 'pill-select';
      var currentOpDef = null;

      opList.forEach(function(opDef) {
        var opt = document.createElement('option');
        opt.value = opDef.id;
        opt.textContent = opDef.label + ' ↕';
        if (opDef.id === rule.operator) {
          opt.selected = true;
          currentOpDef = opDef;
        }
        opSelect.appendChild(opt);
      });

      if (!currentOpDef && opList[0]) {
        currentOpDef = opList[0];
        rule.operator = currentOpDef.id;
      }

      opSelect.addEventListener('change', function(e) {
        rule.operator = e.target.value;
        saveFilterState();
        renderFilterPopover();
        renderCards();
      });
      pill.appendChild(opSelect);

      // 3. Value Input (if operator requires value)
      if (currentOpDef && !currentOpDef.noValue) {
        var divider2 = document.createElement('span');
        divider2.className = 'pill-divider';
        pill.appendChild(divider2);

        var valInput = document.createElement('input');
        valInput.className = 'pill-input';

        if (pType === 'number') {
          valInput.type = 'number';
          valInput.value = (rule.value !== undefined && rule.value !== null) ? String(rule.value) : '';
        } else if (pType === 'date') {
          valInput.type = 'date';
          valInput.value = rule.value || '';
        } else {
          valInput.type = 'text';
          valInput.placeholder = 'Value...';
          valInput.value = rule.value || '';
        }

        valInput.addEventListener('input', function(e) {
          rule.value = pType === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value;
          saveFilterState();
          renderCards();
        });
        pill.appendChild(valInput);
      }

      row.appendChild(pill);

      // Delete Button with Lucide X icon
      var delBtn = document.createElement('button');
      delBtn.className = 'popover-rule-delete';
      delBtn.title = 'Remove filter';
      delBtn.appendChild(createIconSvg('x', 'b2h-icon-sm'));
      delBtn.addEventListener('click', function() {
        activeFilterRules.splice(idx, 1);
        if (activeFilterRules.length > 0 && activeFilterRules[0]) {
          activeFilterRules[0].conjunction = 'where';
        }
        saveFilterState();
        renderFilterPopover();
        renderCards();
      });
      row.appendChild(delBtn);

      setupDragDrop(row, idx, activeFilterRules, function() {
        if (activeFilterRules[0]) activeFilterRules[0].conjunction = 'where';
        saveFilterState();
        renderFilterPopover();
        renderCards();
      });

      filterRulesList.appendChild(row);
    });

    updateToolbarActiveStates();
  }

  function renderPropertiesPopover() {
    if (!propertiesList) return;
    propertiesList.innerHTML = '';

    var allProps = getAllAvailablePropertyKeys();

    allProps.forEach(function(prop) {
      var meta = getPropertyMetadata(prop);
      var isVisible = activeOrder.includes(prop);

      var row = document.createElement('div');
      row.className = 'property-visibility-row';

      var left = document.createElement('div');
      left.className = 'property-visibility-left';

      var chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'property-visibility-toggle';
      chk.checked = isVisible;
      chk.addEventListener('change', function() {
        if (chk.checked) {
          if (!activeOrder.includes(prop)) activeOrder.push(prop);
        } else {
          activeOrder = activeOrder.filter(function(p) { return p !== prop; });
        }
        saveOrderState();
        renderCards();
      });

      var label = document.createElement('span');
      label.textContent = meta.name;

      left.appendChild(chk);
      left.appendChild(createIconSvg(meta.icon || 'type', 'b2h-icon-xs'));
      left.appendChild(label);
      row.appendChild(left);

      propertiesList.appendChild(row);
    });
  }

  // Generic Drag & Drop setup
  var draggedRowIdx = null;

  function setupDragDrop(rowEl, index, arrayRef, onReorder) {
    rowEl.addEventListener('dragstart', function(e) {
      draggedRowIdx = index;
      rowEl.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
      }
    });

    rowEl.addEventListener('dragend', function() {
      rowEl.classList.remove('dragging');
      draggedRowIdx = null;
    });

    rowEl.addEventListener('dragover', function(e) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    });

    rowEl.addEventListener('drop', function(e) {
      e.preventDefault();
      if (draggedRowIdx === null || draggedRowIdx === index) return;
      var movedItem = arrayRef.splice(draggedRowIdx, 1)[0];
      if (movedItem) {
        arrayRef.splice(index, 0, movedItem);
        onReorder();
      }
    });
  }

  // =========================================================================
  // Filtering & Sorting Evaluators
  // =========================================================================

  function passesFilterRules(item) {
    if (activeFilterRules.length === 0) return true;

    var overallResult = true;

    for (var i = 0; i < activeFilterRules.length; i++) {
      var rule = activeFilterRules[i];
      var rulePassed = evaluateSingleFilterRule(item, rule);

      if (i === 0) {
        overallResult = rulePassed;
      } else {
        var conj = rule.conjunction || 'and';
        if (conj === 'or') {
          overallResult = overallResult || rulePassed;
        } else {
          overallResult = overallResult && rulePassed;
        }
      }
    }

    return overallResult;
  }

  function evaluateSingleFilterRule(item, rule) {
    var rawVal = getItemValue(item, rule.property);
    var pType = getPropertyType(rule.property);
    var op = rule.operator;
    var target = rule.value;

    if (op === 'is_empty') {
      if (rawVal === undefined || rawVal === null || rawVal === '') return true;
      if (Array.isArray(rawVal) && rawVal.length === 0) return true;
      return false;
    }
    if (op === 'is_not_empty') {
      if (rawVal === undefined || rawVal === null || rawVal === '') return false;
      if (Array.isArray(rawVal) && rawVal.length === 0) return false;
      return true;
    }

    if (pType === 'checkbox') {
      var isTrue = Boolean(rawVal) === true;
      if (op === 'is_checked') return isTrue;
      if (op === 'is_not_checked') return !isTrue;
      return true;
    }

    if (pType === 'number') {
      var numVal = Number(rawVal);
      var numTarget = Number(target);
      if (isNaN(numVal) || isNaN(numTarget)) return false;

      if (op === '=') return numVal === numTarget;
      if (op === '!=') return numVal !== numTarget;
      if (op === '>') return numVal > numTarget;
      if (op === '<') return numVal < numTarget;
      if (op === '>=') return numVal >= numTarget;
      if (op === '<=') return numVal <= numTarget;
      return true;
    }

    if (pType === 'date') {
      var dateVal = rawVal ? new Date(String(rawVal)).getTime() : NaN;
      var dateTarget = target ? new Date(String(target)).getTime() : NaN;
      if (isNaN(dateVal) || isNaN(dateTarget)) return false;

      if (op === 'is') {
        var d1 = new Date(dateVal).toISOString().slice(0, 10);
        var d2 = new Date(dateTarget).toISOString().slice(0, 10);
        return d1 === d2;
      }
      if (op === 'is_before') return dateVal < dateTarget;
      if (op === 'is_after') return dateVal > dateTarget;
      if (op === 'is_on_or_before') return dateVal <= dateTarget;
      if (op === 'is_on_or_after') return dateVal >= dateTarget;
      return true;
    }

    if (pType === 'list') {
      var isTagProp = rule.property === 'file.tags' || rule.property === 'tags' || rule.property.toLowerCase().indexOf('tag') !== -1;
      var rawTargetStr = String(target != null ? target : '').toLowerCase();
      var searchStr = isTagProp ? rawTargetStr.replace(/^#/, '') : rawTargetStr;

      var rawList = Array.isArray(rawVal) ? rawVal : (rawVal != null && rawVal !== '' ? [rawVal] : []);
      var arr = rawList.map(function(x) {
        var s = String(x).toLowerCase();
        return isTagProp ? s.replace(/^#/, '') : s;
      });

      if (op === 'contains' || op === 'has_tag') {
        return arr.some(function(item) {
          return item === searchStr || item.indexOf(searchStr) !== -1;
        });
      }
      if (op === 'does_not_contain') {
        return !arr.some(function(item) {
          return item === searchStr || item.indexOf(searchStr) !== -1;
        });
      }
      if (op === 'contains_any') {
        var tokensAny = searchStr.split(/[\s,]+/).filter(Boolean);
        return tokensAny.some(function(tok) {
          return arr.some(function(item) { return item === tok || item.indexOf(tok) !== -1; });
        });
      }
      if (op === 'contains_all') {
        var tokensAll = searchStr.split(/[\s,]+/).filter(Boolean);
        return tokensAll.every(function(tok) {
          return arr.some(function(item) { return item === tok || item.indexOf(tok) !== -1; });
        });
      }
      if (op === 'does_not_contain_any') {
        var tokensNone = searchStr.split(/[\s,]+/).filter(Boolean);
        return !tokensNone.some(function(tok) {
          return arr.some(function(item) { return item === tok || item.indexOf(tok) !== -1; });
        });
      }
      return true;
    }

    // Default: text / link
    var strVal = String(rawVal != null ? rawVal : '').toLowerCase();
    var strTarget = String(target != null ? target : '').toLowerCase();

    if (op === 'is') return strVal === strTarget;
    if (op === 'is_not') return strVal !== strTarget;
    if (op === 'contains') return strVal.includes(strTarget);
    if (op === 'does_not_contain') return !strVal.includes(strTarget);

    return true;
  }

  // =========================================================================
  // Card Rendering Engine
  // =========================================================================

  function renderCards() {
    if (!contentContainer) return;
    var view = base.views[currentViewIdx];
    if (!view) return;

    // Filter items
    var filtered = items.filter(passesFilterRules);

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(function(it) {
        if (it.title.toLowerCase().includes(searchQuery)) return true;
        if (it.tags && it.tags.some(function(t) { return t.toLowerCase().includes(searchQuery); })) return true;
        var propValues = Object.values(it.properties || {});
        for (var i = 0; i < propValues.length; i++) {
          if (String(propValues[i]).toLowerCase().includes(searchQuery)) return true;
        }
        return false;
      });
    }

    // Multi-level sorting
    if (activeSortRules.length > 0) {
      filtered.sort(function(a, b) {
        for (var i = 0; i < activeSortRules.length; i++) {
          var rule = activeSortRules[i];
          var valA = getItemValue(a, rule.property);
          var valB = getItemValue(b, rule.property);
          var isAsc = rule.direction.toUpperCase() === 'ASC';
          var cmp = compareValuesClient(valA, valB, isAsc);
          if (cmp !== 0) return cmp;
        }
        return 0;
      });
    }

    if (itemCountBadge) {
      itemCountBadge.textContent = filtered.length + ' item' + (filtered.length === 1 ? '' : 's');
    }

    contentContainer.innerHTML = '';

    if (filtered.length === 0) {
      var emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      emptyDiv.innerHTML = '<h3>No items found</h3><p>Try adjusting your search or filters.</p>';
      contentContainer.appendChild(emptyDiv);
      return;
    }

    var viewType = (view.type || 'cards').toLowerCase();
    if (viewType === 'table') {
      renderTableView(contentContainer, filtered, view);
    } else {
      renderGalleryCards(contentContainer, filtered, view);
    }
  }

  function renderGalleryCards(contentContainer, filtered, view) {
    // Grouping
    if (activeGroupRule && activeGroupRule.property) {
      var groupProp = activeGroupRule.property;
      var isGroupAsc = activeGroupRule.direction.toUpperCase() === 'ASC';

      var groups = new Map();
      filtered.forEach(function(it) {
        var keyVal = getItemValue(it, groupProp);
        var keyStr = (keyVal === undefined || keyVal === null || keyVal === '') ? 'Uncategorized' : String(keyVal);
        if (!groups.has(keyStr)) groups.set(keyStr, []);
        groups.get(keyStr).push(it);
      });

      var sortedKeys = Array.from(groups.keys()).sort(function(a, b) {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return compareValuesClient(a, b, isGroupAsc);
      });

      sortedKeys.forEach(function(grpKey) {
        var grpItems = groups.get(grpKey);
        if (!grpItems) return;
        var grpSection = document.createElement('section');
        grpSection.className = 'group-section bases-group';
        grpSection.setAttribute('data-group-value', grpKey);

        var grpHeader = document.createElement('div');
        grpHeader.className = 'group-header bases-group-header';
        grpHeader.innerHTML = '<span class="group-title bases-group-title">' + escapeHtml(grpKey) + '</span><span class="group-count bases-group-count">' + grpItems.length + '</span>';
        grpSection.appendChild(grpHeader);

        var grid = document.createElement('div');
        grid.className = 'cards-grid bases-cards-grid';
        grpItems.forEach(function(item) {
          grid.appendChild(createCardElement(item));
        });
        grpSection.appendChild(grid);

        contentContainer.appendChild(grpSection);
      });
    } else {
      var grid = document.createElement('div');
      grid.className = 'cards-grid bases-cards-grid';
      filtered.forEach(function(item) {
        grid.appendChild(createCardElement(item));
      });
      contentContainer.appendChild(grid);
    }
  }

  // =========================================================================
  // Table View & Summarize Engine
  // =========================================================================

  function renderTableView(container, itemsList, view) {
    var cols = (activeOrder && activeOrder.length > 0) ? activeOrder : getAllAvailablePropertyKeys();
    if (cols.length === 0) cols = ['file.name'];

    var viewSummaries = view.summaries || {};
    var colSizes = view.columnSize || {};

    if (activeGroupRule && activeGroupRule.property) {
      var groupProp = activeGroupRule.property;
      var isGroupAsc = activeGroupRule.direction.toUpperCase() === 'ASC';

      var groups = new Map();
      itemsList.forEach(function(it) {
        var keyVal = getItemValue(it, groupProp);
        var keyStr = (keyVal === undefined || keyVal === null || keyVal === '') ? 'Uncategorized' : String(keyVal);
        if (!groups.has(keyStr)) groups.set(keyStr, []);
        groups.get(keyStr).push(it);
      });

      var sortedKeys = Array.from(groups.keys()).sort(function(a, b) {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return compareValuesClient(a, b, isGroupAsc);
      });

      sortedKeys.forEach(function(grpKey) {
        var grpItems = groups.get(grpKey);
        if (!grpItems) return;

        var grpSection = document.createElement('section');
        grpSection.className = 'group-section bases-group bases-table-group-section';
        grpSection.setAttribute('data-group-value', grpKey);

        var grpHeader = document.createElement('div');
        grpHeader.className = 'group-header bases-group-header';
        grpHeader.innerHTML = '<span class="group-title bases-group-title">' + escapeHtml(grpKey) + '</span><span class="group-count bases-group-count">' + grpItems.length + '</span>';
        grpSection.appendChild(grpHeader);

        var tableWrapper = createTableElement(grpItems, cols, colSizes, viewSummaries, true);
        grpSection.appendChild(tableWrapper);

        container.appendChild(grpSection);
      });

      // Overall grand summary if multiple groups exist and summaries are configured
      if (sortedKeys.length > 1 && hasAnySummaries(cols, viewSummaries)) {
        var grandSummarySection = document.createElement('div');
        grandSummarySection.className = 'bases-table-wrapper bases-grand-summary-wrapper';
        var grandTable = document.createElement('table');
        grandTable.className = 'bases-table';
        var grandFoot = createTableSummaryFoot(itemsList, cols, colSizes, viewSummaries, 'Grand Total');
        grandTable.appendChild(grandFoot);
        grandSummarySection.appendChild(grandTable);
        container.appendChild(grandSummarySection);
      }
    } else {
      var tableWrapper = createTableElement(itemsList, cols, colSizes, viewSummaries, false);
      container.appendChild(tableWrapper);
    }
  }

  function createTableElement(itemsList, cols, colSizes, viewSummaries, isGrouped) {
    var wrapper = document.createElement('div');
    wrapper.className = 'bases-table-wrapper';

    var table = document.createElement('table');
    table.className = 'bases-table';

    // 1. Table Header (thead)
    var thead = document.createElement('thead');
    thead.className = 'bases-thead';
    var headerRow = document.createElement('tr');
    headerRow.className = 'bases-tr bases-th-row';

    cols.forEach(function(col) {
      var th = document.createElement('th');
      th.className = 'bases-th';
      th.setAttribute('data-column', col);

      var width = getColumnWidth(col, colSizes);
      if (width) {
        th.style.width = width + 'px';
        th.style.minWidth = width + 'px';
      }

      var thContent = document.createElement('div');
      thContent.className = 'th-content';

      var meta = getPropertyMetadata(col);
      var iconSpan = document.createElement('span');
      iconSpan.className = 'th-icon';
      iconSpan.appendChild(createIconSvg(meta.icon || 'type', 'b2h-icon-xs'));
      thContent.appendChild(iconSpan);

      var nameSpan = document.createElement('span');
      nameSpan.className = 'th-name';
      nameSpan.textContent = getPropertyDisplayName(col);
      nameSpan.setAttribute('dir', 'auto');
      thContent.appendChild(nameSpan);

      // Sort indicator
      var sortRule = activeSortRules.find(function(s) { return s.property === col; });
      if (sortRule) {
        var sortIconSpan = document.createElement('span');
        sortIconSpan.className = 'th-sort-icon';
        var isAsc = sortRule.direction.toUpperCase() === 'ASC';
        sortIconSpan.appendChild(createIconSvg(isAsc ? 'arrow-up' : 'arrow-down', 'b2h-icon-xs'));
        thContent.appendChild(sortIconSpan);
      }

      th.appendChild(thContent);

      // Interactive Column Header Sorting
      th.addEventListener('click', function() {
        toggleColumnSort(col);
      });

      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // 2. Table Body (tbody)
    var tbody = document.createElement('tbody');
    tbody.className = 'bases-tbody';

    itemsList.forEach(function(item) {
      var tr = document.createElement('tr');
      tr.className = 'bases-tr';
      if (item.id) tr.setAttribute('data-item-id', item.id);

      cols.forEach(function(col) {
        var td = document.createElement('td');
        td.className = 'bases-td';
        td.setAttribute('data-column', col);

        var val = getItemValue(item, col);
        var meta = getPropertyMetadata(col);

        if (col === 'file.name' || col === 'name' || col === 'file') {
          if (exportScope !== 'bases-only') {
            var titleLink = document.createElement('a');
            titleLink.className = 'table-cell-title';
            titleLink.href = 'javascript:void(0);';
            titleLink.appendChild(createIconSvg('file-text', 'b2h-icon-xs'));
            var titleText = document.createElement('span');
            titleText.textContent = item.title;
            titleText.setAttribute('dir', 'auto');
            titleLink.appendChild(titleText);
            titleLink.addEventListener('click', function(ev) {
              ev.preventDefault();
              openNoteModal(item);
            });
            td.appendChild(titleLink);
          } else {
            var titleSpan = document.createElement('span');
            titleSpan.className = 'table-cell-title table-cell-title-static';
            titleSpan.appendChild(createIconSvg('file-text', 'b2h-icon-xs'));
            var titleTextStatic = document.createElement('span');
            titleTextStatic.textContent = item.title;
            titleTextStatic.setAttribute('dir', 'auto');
            titleSpan.appendChild(titleTextStatic);
            td.appendChild(titleSpan);
          }
        } else if (meta.type === 'checkbox' || typeof val === 'boolean') {
          var boolSpan = document.createElement('span');
          boolSpan.className = val ? 'table-bool-checked' : 'table-bool-unchecked';
          boolSpan.appendChild(createIconSvg(val ? 'check' : 'x', 'b2h-icon-xs'));
          td.appendChild(boolSpan);
        } else if (meta.type === 'list' || Array.isArray(val)) {
          var arr = Array.isArray(val) ? val : (val ? [String(val)] : []);
          arr.forEach(function(tagItem) {
            var tagPill = document.createElement('span');
            tagPill.className = 'bases-tag-pill';
            tagPill.textContent = String(tagItem);
            tagPill.setAttribute('dir', 'auto');
            td.appendChild(tagPill);
          });
        } else if (meta.type === 'number' || typeof val === 'number') {
          var numSpan = document.createElement('span');
          numSpan.className = 'table-num';
          numSpan.textContent = (val !== undefined && val !== null) ? String(val) : '';
          td.appendChild(numSpan);
        } else if (meta.type === 'date') {
          var dateSpan = document.createElement('span');
          dateSpan.className = 'table-date';
          dateSpan.textContent = (val !== undefined && val !== null) ? String(val) : '';
          td.appendChild(dateSpan);
        } else if (col.includes('starRating') || (typeof val === 'string' && val.includes('★'))) {
          var starSpan = document.createElement('span');
          starSpan.className = 'card-rating';
          starSpan.textContent = String(val);
          td.appendChild(starSpan);
        } else {
          var textSpan = document.createElement('span');
          textSpan.textContent = (val !== undefined && val !== null) ? String(val) : '';
          textSpan.setAttribute('dir', 'auto');
          td.appendChild(textSpan);
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    // 3. Table Footer (tfoot) - Computed Summarize Row
    if (hasAnySummaries(cols, viewSummaries)) {
      var tfoot = createTableSummaryFoot(itemsList, cols, colSizes, viewSummaries, isGrouped ? 'Group Summary' : null);
      table.appendChild(tfoot);
    }

    wrapper.appendChild(table);
    return wrapper;
  }

  function hasAnySummaries(cols, viewSummaries) {
    if (!viewSummaries) return false;
    for (var i = 0; i < cols.length; i++) {
      if (getColumnSummaryRule(cols[i], viewSummaries)) return true;
    }
    return false;
  }

  function getColumnSummaryRule(col, viewSummaries) {
    if (!viewSummaries) return null;
    if (viewSummaries[col]) return viewSummaries[col];
    var cleanCol = col.replace(/^formula[.]/, '').replace(/^note[.]/, '');
    if (viewSummaries[cleanCol]) return viewSummaries[cleanCol];
    return null;
  }

  function createTableSummaryFoot(itemsList, cols, colSizes, viewSummaries, groupLabel) {
    var tfoot = document.createElement('tfoot');
    tfoot.className = 'bases-tfoot';

    var tr = document.createElement('tr');
    tr.className = 'bases-tr bases-summary-row';

    cols.forEach(function(col, idx) {
      var td = document.createElement('td');
      td.className = 'bases-td bases-summary-cell';
      td.setAttribute('data-column', col);

      var width = getColumnWidth(col, colSizes);
      if (width) {
        td.style.width = width + 'px';
        td.style.minWidth = width + 'px';
      }

      var rule = getColumnSummaryRule(col, viewSummaries);
      if (rule) {
        var summaryResult = calculateSummary(rule, col, itemsList);
        var content = document.createElement('div');
        content.className = 'summary-content';

        var labelSpan = document.createElement('span');
        labelSpan.className = 'summary-type-label';
        labelSpan.textContent = summaryResult.label;
        content.appendChild(labelSpan);

        var valSpan = document.createElement('span');
        valSpan.className = 'summary-result-value';
        valSpan.textContent = String(summaryResult.value);
        content.appendChild(valSpan);

        td.appendChild(content);
      } else if (idx === 0 && groupLabel) {
        var groupLabelSpan = document.createElement('span');
        groupLabelSpan.className = 'summary-type-label';
        groupLabelSpan.textContent = groupLabel;
        td.appendChild(groupLabelSpan);
      }

      tr.appendChild(td);
    });

    tfoot.appendChild(tr);
    return tfoot;
  }

  function calculateSummary(rule, col, itemsList) {
    var rawVals = [];
    var filledVals = [];
    var numVals = [];
    var boolVals = [];

    itemsList.forEach(function(it) {
      var v = getItemValue(it, col);
      rawVals.push(v);
      if (v !== undefined && v !== null && v !== '') {
        filledVals.push(v);
        var n = Number(v);
        if (!isNaN(n) && typeof v !== 'boolean') {
          numVals.push(n);
        }
        if (typeof v === 'boolean') {
          boolVals.push(v);
        }
      }
    });

    // Check if rule refers to a top-level summary formula
    var ruleStr = String(rule).trim();
    if (base.summaries && base.summaries[ruleStr]) {
      ruleStr = String(base.summaries[ruleStr]).trim();
    }

    var lowerRule = ruleStr.toLowerCase();

    // 1. Built-in obsidian summary functions
    if (lowerRule === 'count') {
      return { label: 'Count', value: itemsList.length };
    }
    if (lowerRule === 'filled') {
      return { label: 'Filled', value: filledVals.length };
    }
    if (lowerRule === 'empty') {
      return { label: 'Empty', value: itemsList.length - filledVals.length };
    }
    if (lowerRule === 'unique') {
      var uniq = new Set(filledVals.map(function(x) { return Array.isArray(x) ? x.join(',') : String(x); }));
      return { label: 'Unique', value: uniq.size };
    }
    if (lowerRule === 'checked') {
      var checkedCount = boolVals.filter(function(b) { return b === true; }).length;
      return { label: 'Checked', value: checkedCount };
    }
    if (lowerRule === 'unchecked') {
      var uncheckedCount = boolVals.filter(function(b) { return b === false; }).length;
      return { label: 'Unchecked', value: uncheckedCount };
    }
    if (lowerRule === 'sum') {
      var s = numVals.reduce(function(acc, n) { return acc + n; }, 0);
      return { label: 'Sum', value: Number.isInteger(s) ? s : Math.round(s * 100) / 100 };
    }
    if (lowerRule === 'average' || lowerRule === 'mean' || lowerRule === 'avg') {
      if (numVals.length === 0) return { label: 'Average', value: '-' };
      var sumVal = numVals.reduce(function(acc, n) { return acc + n; }, 0);
      var avg = sumVal / numVals.length;
      return { label: 'Average', value: Math.round(avg * 100) / 100 };
    }
    if (lowerRule === 'median') {
      if (numVals.length === 0) return { label: 'Median', value: '-' };
      var sorted = numVals.slice().sort(function(a, b) { return a - b; });
      var mid = Math.floor(sorted.length / 2);
      var med = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      return { label: 'Median', value: Math.round(med * 100) / 100 };
    }
    if (lowerRule === 'min') {
      if (numVals.length > 0) {
        return { label: 'Min', value: Math.min.apply(null, numVals) };
      }
      if (filledVals.length > 0) {
        var sortedVals = filledVals.slice().sort();
        return { label: 'Min', value: sortedVals[0] };
      }
      return { label: 'Min', value: '-' };
    }
    if (lowerRule === 'max') {
      if (numVals.length > 0) {
        return { label: 'Max', value: Math.max.apply(null, numVals) };
      }
      if (filledVals.length > 0) {
        var sortedVals = filledVals.slice().sort();
        return { label: 'Max', value: sortedVals[sortedVals.length - 1] };
      }
      return { label: 'Max', value: '-' };
    }
    if (lowerRule === 'range') {
      if (numVals.length > 0) {
        var min = Math.min.apply(null, numVals);
        var max = Math.max.apply(null, numVals);
        var diff = max - min;
        return { label: 'Range', value: Number.isInteger(diff) ? diff : Math.round(diff * 100) / 100 };
      }
      return { label: 'Range', value: '-' };
    }

    // 2. Custom formula evaluation
    try {
      var customResult = evaluateCustomSummaryFormula(ruleStr, filledVals, numVals);
      return { label: ruleStr.replace(/^values[.]/, ''), value: customResult };
    } catch (e) {
      console.warn('Failed to evaluate custom summary formula:', ruleStr, e);
      return { label: 'Summary', value: '-' };
    }
  }

  function evaluateCustomSummaryFormula(formula, filledVals, numVals) {
    var rawValues = filledVals.slice();
    var numbers = numVals.slice();

    function ValuesWrapper(arr, nums) {
      this.items = arr;
      this.nums = nums;
    }

    ValuesWrapper.prototype.sum = function() {
      var s = this.nums.reduce(function(a, b) { return a + b; }, 0);
      return Number.isInteger(s) ? s : Math.round(s * 100) / 100;
    };

    ValuesWrapper.prototype.mean = function() {
      if (this.nums.length === 0) return 0;
      var s = this.nums.reduce(function(a, b) { return a + b; }, 0);
      return s / this.nums.length;
    };

    ValuesWrapper.prototype.avg = function() {
      return this.mean();
    };

    ValuesWrapper.prototype.median = function() {
      if (this.nums.length === 0) return 0;
      var sorted = this.nums.slice().sort(function(a, b) { return a - b; });
      var mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    ValuesWrapper.prototype.min = function() {
      return this.nums.length > 0 ? Math.min.apply(null, this.nums) : 0;
    };

    ValuesWrapper.prototype.max = function() {
      return this.nums.length > 0 ? Math.max.apply(null, this.nums) : 0;
    };

    ValuesWrapper.prototype.count = function() {
      return this.items.length;
    };

    ValuesWrapper.prototype.unique = function() {
      var set = new Set(this.items.map(String));
      return set.size;
    };

    Number.prototype.round = function(decimals) {
      var factor = Math.pow(10, decimals || 0);
      return Math.round(this * factor) / factor;
    };

    var values = new ValuesWrapper(rawValues, numbers);
    var safeEvaluator = new Function('values', 'return (' + formula + ');');
    var res = safeEvaluator(values);

    if (typeof res === 'number') {
      return Number.isInteger(res) ? res : Math.round(res * 100) / 100;
    }
    return res !== undefined && res !== null ? String(res) : '-';
  }

  function getColumnWidth(col, colSizes) {
    if (!colSizes) return null;
    if (colSizes[col]) return colSizes[col];
    var cleanCol = col.replace(/^formula[.]/, '').replace(/^note[.]/, '');
    if (colSizes[cleanCol]) return colSizes[cleanCol];
    return null;
  }

  function getPropertyDisplayName(col) {
    if (col === 'file.name' || col === 'name' || col === 'file') return 'Name';
    var clean = col.replace(/^formula[.]/, '').replace(/^note[.]/, '');
    var meta = getPropertyMetadata(col);
    return (meta && meta.name && meta.name !== col) ? meta.name : clean;
  }

  function toggleColumnSort(col) {
    var existingIdx = activeSortRules.findIndex(function(s) { return s.property === col; });
    if (existingIdx === -1) {
      activeSortRules.push({ property: col, direction: 'ASC' });
    } else if (activeSortRules[existingIdx].direction.toUpperCase() === 'ASC') {
      activeSortRules[existingIdx].direction = 'DESC';
    } else {
      activeSortRules.splice(existingIdx, 1);
    }
    saveSortState();
    renderSortPopover();
    renderCards();
  }

  function createCardElement(item) {
    var card = document.createElement('div');
    card.className = 'base-card bases-card';
    if (item.id) card.setAttribute('data-item-id', item.id);
    if (item.title) card.setAttribute('data-item-title', item.title);

    var imgWrapper = document.createElement('div');
    imgWrapper.className = 'card-image-wrapper bases-card-image-wrapper';

    var imgSrc = item.coverImageBase64 || item.coverAssetRelativePath || item.coverImage;
    if (imgSrc) {
      var img = document.createElement('img');
      img.className = 'card-image bases-card-image';
      img.src = imgSrc;
      img.alt = item.title;
      img.loading = 'lazy';
      img.onerror = function() {
        img.remove();
        imgWrapper.appendChild(createPlaceholder());
      };
      imgWrapper.appendChild(img);
    } else {
      imgWrapper.appendChild(createPlaceholder());
    }
    card.appendChild(imgWrapper);

    var body = document.createElement('div');
    body.className = 'card-body bases-card-body';

    var order = activeOrder.length > 0 ? activeOrder : ['file.name', 'rating'];
    var renderedTitle = false;

    order.forEach(function(prop) {
      var val = getItemValue(item, prop);
      if (val === undefined || val === null || val === '') return;

      if (prop === 'file.name' || prop === 'name') {
        var titleEl = document.createElement('div');
        titleEl.className = 'card-title bases-card-title';
        titleEl.textContent = String(val);
        titleEl.setAttribute('dir', 'auto');
        body.appendChild(titleEl);
        renderedTitle = true;
      } else if (prop === 'badge' || prop === 'tags' || prop === 'file.tags') {
        var badgeEl = document.createElement('div');
        badgeEl.className = 'card-badge bases-card-badge';
        badgeEl.textContent = Array.isArray(val) ? val.join(' ') : String(val);
        badgeEl.setAttribute('dir', 'auto');
        body.appendChild(badgeEl);
      } else if (prop.includes('starRating') || (typeof val === 'string' && val.includes('★'))) {
        var starEl = document.createElement('div');
        starEl.className = 'card-rating bases-card-rating';
        starEl.textContent = String(val);
        body.appendChild(starEl);
      } else {
        var row = document.createElement('div');
        row.className = 'card-prop-item bases-card-property';
        var cleanKey = prop.replace(/^formula\./, '').replace(/^note\./, '');
        row.setAttribute('data-property', cleanKey);
        var displayVal = Array.isArray(val) ? val.join(', ') : String(val);
        row.innerHTML = '<span class="card-prop-key bases-property-key">' + escapeHtml(cleanKey) + '</span><span class="card-prop-val bases-property-value" dir="auto">' + escapeHtml(displayVal) + '</span>';
        body.appendChild(row);
      }
    });

    if (!renderedTitle) {
      var fallbackTitle = document.createElement('div');
      fallbackTitle.className = 'card-title bases-card-title';
      fallbackTitle.textContent = item.title;
      fallbackTitle.setAttribute('dir', 'auto');
      body.insertBefore(fallbackTitle, body.firstChild);
    }

    card.appendChild(body);

    if (exportScope !== 'bases-only') {
      card.addEventListener('click', function() {
        openNoteModal(item);
      });
    } else {
      card.classList.add('bases-card-static');
    }

    return card;
  }

  function createPlaceholder() {
    var ph = document.createElement('div');
    ph.className = 'card-image-placeholder bases-card-image-placeholder';
    ph.appendChild(createIconSvg('image', 'b2h-icon-xl'));
    return ph;
  }

  function openNoteModal(item) {
    if (exportScope === 'bases-only') return;
    if (!noteModal) return;
    if (modalTitle) {
      modalTitle.textContent = item.title;
      modalTitle.setAttribute('dir', 'auto');
    }

    if (modalProperties) {
      modalProperties.innerHTML = '';
      var props = Object.entries(item.properties || {});
      props.forEach(function(entry) {
        var key = entry[0];
        var val = entry[1];
        if (key === 'cover' || key === 'cover_source' || key === 'image') return;
        var chip = document.createElement('div');
        chip.className = 'modal-prop-chip';
        var displayVal = Array.isArray(val) ? val.join(', ') : String(val != null ? val : '');
        chip.innerHTML = '<strong>' + escapeHtml(key) + ':</strong> ' + escapeHtml(displayVal);
        modalProperties.appendChild(chip);
      });
    }

    if (modalMarkdownContent) {
      if (exportScope === 'properties-only') {
        modalMarkdownContent.innerHTML = '';
        modalMarkdownContent.style.display = 'none';
      } else {
        modalMarkdownContent.style.display = '';
        if (item.htmlContent) {
          modalMarkdownContent.innerHTML = item.htmlContent;
        } else if (item.properties && item.properties.source) {
          modalMarkdownContent.innerHTML = '<p><a href="' + escapeHtml(String(item.properties.source)) + '" target="_blank" rel="noopener">Open source link &rarr;</a></p>';
        } else {
          modalMarkdownContent.innerHTML = '<p style="color:var(--text-muted);">No note content exported for this item.</p>';
        }
      }
    }

    noteModal.classList.add('open');
    if (modalOverlay) modalOverlay.classList.add('open');
  }

  function closeNoteModal() {
    if (noteModal) noteModal.classList.remove('open');
    if (!settingsDrawer || !settingsDrawer.classList.contains('open')) {
      if (modalOverlay) modalOverlay.classList.remove('open');
    }
  }

  function openSettings() {
    closeAllPopovers();
    if (settingsDrawer) settingsDrawer.classList.add('open');
    if (modalOverlay) modalOverlay.classList.add('open');
  }

  function closeSettings() {
    if (settingsDrawer) settingsDrawer.classList.remove('open');
    if (!noteModal || !noteModal.classList.contains('open')) {
      if (modalOverlay) modalOverlay.classList.remove('open');
    }
  }

  function applyTheme(theme) {
    currentTheme = theme;
    htmlRoot.setAttribute('data-theme', theme);
    localStorage.setItem('b2h_theme', theme);
    if (themeLightBtn && themeDarkBtn) {
      themeLightBtn.classList.toggle('active', theme === 'light');
      themeDarkBtn.classList.toggle('active', theme === 'dark');
    }
  }

  function applyWidth(width) {
    currentWidth = width;
    htmlRoot.setAttribute('data-width', width);
    localStorage.setItem('b2h_width', width);
    if (widthFullBtn && widthNormalBtn && widthNarrowBtn) {
      widthFullBtn.classList.toggle('active', width === 'full');
      widthNormalBtn.classList.toggle('active', width === 'normal');
      widthNarrowBtn.classList.toggle('active', width === 'narrow');
    }
  }

  function applyFont(font) {
    currentFont = font;
    htmlRoot.setAttribute('data-font', font);
    localStorage.setItem('b2h_font', font);
    if (fontSelect) fontSelect.value = font;
  }

  function compareValuesClient(a, b, isAsc) {
    if (a === b) return 0;
    if (a === undefined || a === null) return isAsc ? 1 : -1;
    if (b === undefined || b === null) return isAsc ? -1 : 1;

    var numA = Number(a);
    var numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB) && typeof a !== 'boolean' && typeof b !== 'boolean') {
      return isAsc ? numA - numB : numB - numA;
    }

    var strA = String(a).toLowerCase();
    var strB = String(b).toLowerCase();
    var res = strA.localeCompare(strB);
    return isAsc ? res : -res;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
