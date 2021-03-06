/*
 The MIT License (MIT)

 Copyright (c) 2014 Daniel Cohen Gindi (danielgindi@gmail.com)

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:
this._$table
 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
 */
/* global jQuery, _, Backbone */
/*jshint -W018 */
(function (global, $) {
    'use strict';

    var userAgent = navigator.userAgent;
    var ieVersion = userAgent.indexOf('MSIE ') != -1 ? parseFloat(userAgent.substr(userAgent.indexOf('MSIE ') + 5)) : null;
    var hasIeDragAndDropBug = ieVersion && ieVersion < 10;
    var createElement = _.bind(document.createElement, document);

    function webkitRenderBugfix(el) {
        // BUGFIX: WebKit has a bug where it does not relayout, and this affects us because scrollbars 
        //   are still calculated even though they are not there yet. This is the last resort.
        var oldDisplay = el.style.display;
        el.style.display = 'none';
        el.offsetHeight; // No need to store this anywhere, the reference is enough
        el.style.display = oldDisplay;
        return el;
    }

    function relativizeElement($el) {
        if (!_.contains(['relative', 'absolute', 'fixed'], $el.css('position'))) {
            $el.css('position', 'relative');
        }
    }

    
    /**
     * @class DGTable
     * @extends Backbone.View
     */
    var DGTable = Backbone.View.extend(
        /** @lends DGTable.prototype */
        {
            /** @expose */
            className: 'dgtable-wrapper',
            
            /** @expose */
            tagName: 'div',
            
            /** @expose */
            VERSION: '0.4.9',

            /**
             * @constructs
             * @expose
             * @param {INIT_OPTIONS?} options initialization options
             */
            initialize: function (options) {

                options = options || {};
                
                options.columns = options.columns || [];

                this._onMouseMoveResizeAreaBound = _.bind(this._onMouseMoveResizeArea, this);
                this._onEndDragColumnHeaderBound = _.bind(this._onEndDragColumnHeader, this);
                this._onTableScrolledHorizontallyBound = _.bind(this._onTableScrolledHorizontally, this);

                this.$el.on('dragend', this._onEndDragColumnHeaderBound);

                /**
                 * @private
                 * @field {Boolean} _tableSkeletonNeedsRendering */
                this._tableSkeletonNeedsRendering = true;

                var settings = this.settings = {};

                /**
                 * @private
                 * @field {Boolean} virtualTable */
                settings.virtualTable = options.virtualTable === undefined ? true : !!options.virtualTable;

                /**
                 * @private
                 * @field {Number} rowsBufferSize */
                settings.rowsBufferSize = options.rowsBufferSize || 3;

                /**
                 * @private
                 * @field {Number} minColumnWidth */
                settings.minColumnWidth = Math.max(options.minColumnWidth || 35, 0);

                /**
                 * @private
                 * @field {Number} resizeAreaWidth */
                settings.resizeAreaWidth = options.resizeAreaWidth || 8;

                /**
                 * @private
                 * @field {Boolean} resizableColumns */
                settings.resizableColumns = options.resizableColumns === undefined ? true : !!options.resizableColumns;

                /**
                 * @private
                 * @field {Boolean} movableColumns */
                settings.movableColumns = options.movableColumns === undefined ? true : !!options.movableColumns;

                /**
                 * @private
                 * @field {Number} sortableColumns */
                settings.sortableColumns = options.sortableColumns === undefined ? 1 : (parseInt(options.sortableColumns, 10) || 1);

                /**
                 * @private
                 * @field {Boolean} adjustColumnWidthForSortArrow */
                settings.adjustColumnWidthForSortArrow = options.adjustColumnWidthForSortArrow === undefined ? true : !!options.adjustColumnWidthForSortArrow;

                /**
                 * @private
                 * @field {Boolean} convertColumnWidthsToRelative */
                settings.convertColumnWidthsToRelative = options.convertColumnWidthsToRelative === undefined ? false : !!options.convertColumnWidthsToRelative;

                /**
                 * @private
                 * @field {String} cellClasses */
                settings.cellClasses = options.cellClasses === undefined ? '' : options.cellClasses;

                /**
                 * @private
                 * @field {String} resizerClassName */
                settings.resizerClassName = options.resizerClassName === undefined ? 'dgtable-resize' : options.resizerClassName;

                /**
                 * @private
                 * @field {String} tableClassName */
                settings.tableClassName = options.tableClassName === undefined ? 'dgtable' : options.tableClassName;

                /**
                 * @private
                 * @field {Boolean} allowCellPreview */
                settings.allowCellPreview = options.allowCellPreview === undefined ? true : options.allowCellPreview;

                /**
                 * @private
                 * @field {Boolean} allowHeaderCellPreview */
                settings.allowHeaderCellPreview = options.allowHeaderCellPreview === undefined ? true : options.allowHeaderCellPreview;

                /**
                 * @private
                 * @field {String} cellPreviewClassName */
                settings.cellPreviewClassName = options.cellPreviewClassName === undefined ? 'dgtable-cell-preview' : options.cellPreviewClassName;

                /**
                 * @private
                 * @field {Boolean} cellPreviewAutoBackground */
                settings.cellPreviewAutoBackground = options.cellPreviewAutoBackground === undefined ? true : options.cellPreviewAutoBackground;

                /**
                 * @private
                 * @field {Function(String,Boolean)Function(a,b)Boolean} comparatorCallback */
                settings.comparatorCallback = options.comparatorCallback === undefined ? null : options.comparatorCallback;

                /**
                 * @private
                 * @field {Boolean} width */
                settings.width = options.width === undefined ? DGTable.Width.NONE : options.width;

                /**
                 * @private
                 * @field {Boolean} relativeWidthGrowsToFillWidth */
                settings.relativeWidthGrowsToFillWidth = options.relativeWidthGrowsToFillWidth === undefined ? true : !!options.relativeWidthGrowsToFillWidth;

                /**
                 * @private
                 * @field {Boolean} relativeWidthShrinksToFillWidth */
                settings.relativeWidthShrinksToFillWidth = options.relativeWidthShrinksToFillWidth === undefined ? false : !!options.relativeWidthShrinksToFillWidth;

                /**
                 * @private
                 * @field {Function} cellFormatter */
                settings.cellFormatter = options.cellFormatter || function (val) {
                    return val;
                };
                
                /**
                 * @private
                 * @field {Function} headerCellFormatter */
                settings.headerCellFormatter = options.headerCellFormatter || function (val) {
                    return val;
                };

                /** @private
                 * @field {Number} height */
                settings.height = options.height;

                var i, len, col, column, columnData, order;

                // Prepare columns
                var columns = new DGTable.ColumnCollection();
                for (i = 0, order = 0; i < options.columns.length; i++) {
                    columnData = options.columns[i];
                    column = this._initColumnFromData(columnData);
                    if (columnData.order !== undefined) {
                        if (columnData.order > order) {
                            order = columnData.order + 1;
                        }
                        column.order = columnData.order;
                    } else {
                        column.order = order++;
                    }
                    columns.push(column);
                }
                columns.normalizeOrder();

                this._columns = columns;
                this._visibleColumns = columns.getVisibleColumns();
                this._ensureVisibleColumns();

                var sortColumns = [];
                
                if (options.sortColumn) {
                    
                    var tmpSortColumns = options.sortColumn;
                    
                    if (tmpSortColumns && typeof tmpSortColumns !== 'object') {
                        tmpSortColumns = [tmpSortColumns];
                    }
                    
                    if (tmpSortColumns instanceof Array ||
                        typeof tmpSortColumns === 'object') {
                            
                        for (i = 0, len = tmpSortColumns.length, column; i < len; i++) {
                            var sortColumn = tmpSortColumns[i];
                            if (typeof sortColumn === 'string') {
                                sortColumn = { column: sortColumn, descending: false };
                            }
                            col = this._columns.get(sortColumn.column);
                            sortColumns.push({
                                column: sortColumn.column,
                                comparePath: col.comparePath,
                                descending: sortColumn.descending
                            });
                        }
                    }
                }

                /** @private
                 * @field {DGTable.RowCollection} _rows */
                this._rows = new DGTable.RowCollection({ sortColumn: sortColumns, columns: this.columns });
                this.listenTo(this._rows, 'requiresComparatorForColumn', _.bind(function(returnVal, column, descending){
                        if (settings.comparatorCallback) {
                            returnVal.comparator = settings.comparatorCallback(column, descending);
                        }
                    }, this));

                /** @private
                 * @field {DGTable.RowCollection} _filteredRows */
                this._filteredRows = null;

                /*
                    Setup hover mechanism.
                    We need this to be high performance, as there may be MANY cells to call this on, on creation and destruction.
                    Using native events to spare the overhead of jQuery's event binding, and even just the creation of the jQuery collection object.
                 */

                var that = this;

                /**
                 * @param {Event} evt
                 * @this {HTMLElement}
                 * */
                var hoverMouseOverHandler = function(evt) {
                    evt = evt || event;
                    var relatedTarget = evt.fromElement || evt.relatedTarget;
                    if (relatedTarget == this || jQuery.contains(this, relatedTarget)) return;
                    if (this['__previewEl'] && (relatedTarget == this['__previewEl'] || jQuery.contains(this['__previewEl'], relatedTarget))) return;
                    that._cellMouseOverEvent.call(that, this);
                };

                /**
                 * @param {Event} evt
                 * @this {HTMLElement}
                 * */
                var hoverMouseOutHandler = function(evt) {
                    evt = evt || event;
                    var relatedTarget = evt.toElement || evt.relatedTarget;
                    if (relatedTarget == this || jQuery.contains(this, relatedTarget)) return;
                    if (this['__previewEl'] && (relatedTarget == this['__previewEl'] || jQuery.contains(this['__previewEl'], relatedTarget))) return;
                    that._cellMouseOutEvent.call(that, this);
                };

                if ('addEventListener' in window) {

                    /**
                     * @param {HTMLElement} el cell or header-cell
                     * @returns {DGTable} self
                     * */
                    this._bindCellHoverIn = function (el) {
                        if (!el['__hoverIn']) {
                            el.addEventListener('mouseover', el['__hoverIn'] = _.bind(hoverMouseOverHandler, el));
                        }
                        return this;
                    };

                    /**
                     * @param {HTMLElement} el cell or header-cell
                     * @returns {DGTable} self
                     * */
                    this._unbindCellHoverIn = function (el) {
                        if (el['__hoverIn']) {
                            el.removeEventListener('mouseover', el['__hoverIn']);
                            el['__hoverIn'] = null;
                        }
                        return this;
                    };

                    /**
                     * @param {HTMLElement} el cell or header-cell
                     * @returns {DGTable} self
                     * */
                    this._bindCellHoverOut = function (el) {
                        if (!el['__hoverOut']) {
                            el.addEventListener('mouseout', el['__hoverOut'] = _.bind(hoverMouseOutHandler, el['__cell'] || el));
                        }
                        return this;
                    };

                    /**
                     * @param {HTMLElement} el cell or header-cell
                     * @returns {DGTable} self
                     * */
                    this._unbindCellHoverOut = function (el) {
                        if (el['__hoverOut']) {
                            el.removeEventListener('mouseout', el['__hoverOut']);
                            el['__hoverOut'] = null;
                        }
                        return this;
                    };

                } else {

                    /**
                     * @param {HTMLElement} el cell or header-cell
                     * @returns {DGTable} self
                     * */
                    this._bindCellHoverIn = function (el) {
                        if (!el['__hoverIn']) {
                            el.attachEvent('mouseover', el['__hoverIn'] = _.bind(hoverMouseOverHandler, el));
                        }
                        return this;
                    };

                    /**
                     * @param {HTMLElement} el cell or header-cell
                     * @returns {DGTable} self
                     * */
                    this._unbindCellHoverIn = function (el) {
                        if (el['__hoverIn']) {
                            el.detachEvent('mouseover', el['__hoverIn']);
                            el['__hoverIn'] = null;
                        }
                        return this;
                    };

                    /**
                     * @param {HTMLElement} el cell or header-cell
                     * @returns {DGTable} self
                     * */
                    this._bindCellHoverOut = function (el) {
                        if (!el['__hoverOut']) {
                            el.attachEvent('mouseout', el['__hoverOut'] = _.bind(hoverMouseOutHandler, el['__cell'] || el));
                        }
                        return this;
                    };

                    /**
                     * @param {HTMLElement} el cell or header-cell
                     * @returns {DGTable} self
                     * */
                    this._unbindCellHoverOut = function (el) {
                        if (el['__hoverOut']) {
                            el.detachEvent('mouseout', el['__hoverOut']);
                            el['__hoverOut'] = null;
                        }
                        return this;
                    };

                }

            },
            
            /**
             * Detect column width mode
             * @private
             * @param {Number|String} width
             * @param {Number} minWidth
             * @returns {Object} parsed width
             */
            _parseColumnWidth: function (width, minWidth) {
                    
                var widthSize = parseFloat(width),
                    widthMode = COLUMN_WIDTH_MODE.AUTO; // Default
                    
                if (widthSize > 0) {
                    // Well, it's sure is not AUTO, as we have a value
                    
                    if (width == widthSize + '%') {
                        // It's a percentage!
                        
                        widthMode = COLUMN_WIDTH_MODE.RELATIVE;
                        widthSize /= 100;
                    } else if (widthSize > 0 && widthSize < 1) {
                        // It's a decimal value, as a relative value!
                        
                        widthMode = COLUMN_WIDTH_MODE.RELATIVE;
                    } else {
                        // It's an absolute size!
                            
                        if (widthSize < minWidth) {
                            widthSize = minWidth;
                        }
                        widthMode = COLUMN_WIDTH_MODE.ABSOLUTE;
                    }
                }
                
                return {width: widthSize, mode: widthMode};
            },

            /**
             * @private
             * @param {COLUMN_OPTIONS} columnData
             */
            _initColumnFromData: function(columnData) {
                
                var parsedWidth = this._parseColumnWidth(columnData.width, columnData.ignoreMin ? 0 : this.settings.minColumnWidth);
            
                var col = {
                    name: columnData.name,
                    label: columnData.label === undefined ? columnData.name : columnData.label,
                    width: parsedWidth.width,
                    widthMode: parsedWidth.mode,
                    resizable: columnData.resizable === undefined ? true : columnData.resizable,
                    sortable: columnData.sortable === undefined ? true : columnData.sortable,
                    movable: columnData.movable === undefined ? true : columnData.movable,
                    visible: columnData.visible === undefined ? true : columnData.visible,
                    cellClasses: columnData.cellClasses === undefined ? this.settings.cellClasses : columnData.cellClasses,
                    ignoreMin: columnData.ignoreMin === undefined ? false : !!columnData.ignoreMin
                };
                
                col.dataPath = columnData.dataPath === undefined ? col.name : columnData.dataPath;
                col.comparePath = columnData.comparePath === undefined ? col.dataPath : columnData.comparePath;
                
                if (typeof col.dataPath === 'string') {
                    col.dataPath = col.dataPath.split('.');
                }
                if (typeof col.comparePath === 'string') {
                    col.comparePath = col.comparePath.split('.');
                }
                
                return col;
            },

            /**
             * The default Backbone.remove() function
             * @public
             * @expose
             */
            remove: function () {

                if (this.__removed) {
                    return this;
                }

                if (this._$resizer) {
                    this._$resizer.remove();
                    this._$resizer = null;
                }

                if (this._$tbody) {
                    var trs = this._$tbody[0].childNodes;
                    for (var i = 0, len = trs.length; i < len; i++) {
                        this.trigger('rowdestroy', trs[i]);
                    }
                }

				// Using quotes for __super__ because Google Closure Compiler has a bug...
                DGTable['__super__'].remove.apply(this, arguments);

                this._destroyHeaderCells()._unbindCellEventsForTable();
                if (this._$table) {
                    this._$table.empty();
                }
                if (this._$tbody) {
                    this._$tbody.empty();
                }

                if (this._workerListeners) {
                    for (var j = 0, worker; j < this._workerListeners.length; j++) {
                        worker = this._workerListeners[j];
                        worker.worker.removeEventListener('message', worker.listener, false);
                    }
                    this._workerListeners.length = 0;
                }

                this._rows.length = this._columns.length = 0;

                if (this.__deferredRender) {
                    clearTimeout(this.__deferredRender);
                }

                // Cleanup
                for (var prop in this) {
                    if (this.hasOwnProperty(prop)) {
                        this[prop] = null;
                    }
                }

                this.__removed = true;

                return this;
            },

            /**
             * Destroy, releasing all memory, events and DOM elements
             * @public
             * @expose
             */
            close: function () {
                return this.remove();
            },

            /**
             * @private
             * @returns {DGTable} self
             */
            _unbindCellEventsForTable: function() {
                var i, rows, rowCount, rowToClean, j, cells, cellCount;
                if (this._headerRow) {
                    for (i = 0, rows = this._headerRow.childNodes, rowCount = rows.length; i < rowCount; i++) {
                        rowToClean = rows[i];
                        for (j = 0, cells = rowToClean.childNodes, cellCount = cells.length; j < cellCount; j++) {
                            this._unbindCellHoverIn(cells[j]);
                        }
                    }
                }
                if (this._tbody) {
                    for (i = 0, rows = this._tbody.childNodes, rowCount = rows.length; i < rowCount; i++) {
                        this._unbindCellEventsForRow(rows[i]);
                    }
                }
                return this;
            },

            /**
             * @private
             * @param {HTMLElement} rowToClean
             * @returns {DGTable} self
             */
            _unbindCellEventsForRow: function(rowToClean) {
                for (var i = 0, cells = rowToClean.childNodes, cellCount = cells.length; i < cellCount; i++) {
                    this._unbindCellHoverIn(cells[i]);
                }
                return this;
            },

            /**
             * @public
             * @expose
             * @returns {DGTable} self
             */
            render: function () {
                var that = this,
                    settings = this.settings;

                if (!this.el.offsetParent) {
                    if (!this.__deferredRender) {
                        this.__deferredRender = setTimeout(function () {
                            this.__deferredRender = null;
                            if (!that.__removed && that.el.offsetParent) {
                                that.render();
                            }
                        });
                    }

                    return that;
                }

                if (this._tableSkeletonNeedsRendering === true) {
                    this._tableSkeletonNeedsRendering = false;

                    if (settings.width == DGTable.Width.AUTO) {
                        // We need to do this to return to the specified widths instead. The arrows added to the column widths...
                        that._clearSortArrows();
                    }

                    var lastScrollTop = that._table ? that._table.scrollTop : 0,
                        lastScrollLeft = that._table ? that._table.scrollLeft : 0;

                    that.tableWidthChanged(true, false) // Take this chance to calculate required column widths
                        ._renderSkeleton(); // Actual render

                    if (!settings.virtualTable) {
                        var rows = that._filteredRows || that._rows, rowCount = rows.length;
                        var renderedRows = that.renderRows(0, rowCount - 1);
                        that._$tbody.html('').append(renderedRows);
                        that._updateLastCellWidthFromScrollbar(true);
                    } else {
                        that._updateLastCellWidthFromScrollbar(); // Detect vertical scrollbar height
                    }

                    that._table.scrollTop = lastScrollTop;
                    that._table.scrollLeft = lastScrollLeft;
                    that._header.scrollLeft = lastScrollLeft;

                    this._updateTableWidth(true);

                    // Show sort arrows
                    for (var i = 0; i < this._rows.sortColumn.length; i++) {
                        this._showSortArrow(this._rows.sortColumn[i].column, this._rows.sortColumn[i].descending);
                    }
                    if (settings.adjustColumnWidthForSortArrow && this._rows.sortColumn.length) {
                        this.tableWidthChanged(true);
                    } else if (!settings.virtualTable) {
                        this.tableWidthChanged();
                    }

                    this.trigger('renderskeleton');

                    if (settings.virtualTable) {
                        this._$table.on('scroll', _.bind(this._onVirtualTableScrolled, this));
                        this.render();
                    }

                } else if (settings.virtualTable) {
                    var rowCount = (that._filteredRows || that._rows).length;
                    var scrollTop = this._table.scrollTop;
                    var firstVisible = Math.floor((scrollTop - this._virtualRowHeightFirst) / this._virtualRowHeight) + 1 - settings.rowsBufferSize;
                    var lastVisible = Math.ceil(((scrollTop - this._virtualRowHeightFirst + this._visibleHeight) / this._virtualRowHeight)) + settings.rowsBufferSize;
                    if (firstVisible < 0) firstVisible = 0;
                    if (lastVisible >= rowCount) {
                        lastVisible = rowCount - 1;
                    }

                    var oldFirstVisible = -1, oldLastVisible = -1;
                    var tbodyChildNodes = that._tbody.childNodes;
                    if (tbodyChildNodes.length) {
                        oldFirstVisible = tbodyChildNodes[0]['rowIndex'];
                        oldLastVisible = tbodyChildNodes[tbodyChildNodes.length - 1]['rowIndex'];
                    }

                    if (oldFirstVisible !== -1 && oldFirstVisible < firstVisible) {
                        var countToRemove = Math.min(oldLastVisible + 1, firstVisible) - oldFirstVisible;
                        for (var i = 0; i < countToRemove; i++) {
                            that.trigger('rowdestroy', tbodyChildNodes[0]);
                            that._unbindCellEventsForRow(tbodyChildNodes[0]);
                            that._tbody.removeChild(tbodyChildNodes[0]);
                        }
                        oldFirstVisible += countToRemove;
                        if (oldFirstVisible > oldLastVisible) {
                            oldFirstVisible = oldLastVisible = -1;
                        }
                    } else if (oldLastVisible !== -1 && oldLastVisible > lastVisible) {
                        var countToRemove = oldLastVisible - Math.max(oldFirstVisible - 1, lastVisible);
                        for (var i = 0; i < countToRemove; i++) {
                            that.trigger('rowdestroy', tbodyChildNodes[tbodyChildNodes.length - 1]);
                            that._unbindCellEventsForRow(tbodyChildNodes[tbodyChildNodes.length - 1]);
                            that._tbody.removeChild(tbodyChildNodes[tbodyChildNodes.length - 1]);
                        }
                        if (oldLastVisible < oldFirstVisible) {
                            oldFirstVisible = oldLastVisible = -1;
                        }
                    }

                    if (firstVisible < oldFirstVisible) {
                        var renderedRows = that.renderRows(firstVisible, Math.min(lastVisible, oldFirstVisible - 1));
                        that._$tbody.prepend(renderedRows);
                    }
                    if (lastVisible > oldLastVisible || oldLastVisible === -1) {
                        var renderedRows = that.renderRows(oldLastVisible === -1 ? firstVisible : oldLastVisible + 1, lastVisible);
                        that._$tbody.append(renderedRows);
                    }
                }
                this.trigger('render');
                return this;
            },

            /**
             * Forces a full render of the table
             * @public
             * @expose
             * @returns {DGTable} self
             */
            clearAndRender: function () {
                this._tableSkeletonNeedsRendering = true;
                return this.render();
            },

            /**
             * Render rows
             * @private
             * @param {Number} first first row to render
             * @param {Number} last last row to render
             * @returns {DocumentFragment} fragment containing all rendered rows
             */
            renderRows: function (first, last) {

                var that = this,
                    settings = that.settings,
                    tableClassName = settings.tableClassName,
                    rowClassName = tableClassName + '-row',
                    cellClassName = tableClassName + '-cell',
                    rows = that._filteredRows || that._rows,
                    isDataFiltered = !!that._filteredRows,
                    allowCellPreview = settings.allowCellPreview,
                    visibleColumns = that._visibleColumns,
                    cellFormatter = settings.cellFormatter,
                    isVirtual = settings.virtualTable,
                    virtualRowHeightFirst = that._virtualRowHeightFirst,
                    virtualRowHeight = that._virtualRowHeight,
                    top,
                    physicalRowIndex,
                    dataPath,
                    dataPathIndex,
                    colValue;

                var colCount = visibleColumns.length;
                for (var colIndex = 0, column; colIndex < colCount; colIndex++) {
                    column = visibleColumns[colIndex];
                    column._finalWidth = (column.actualWidthConsideringScrollbarWidth || column.actualWidth);
                }

                var bodyFragment = document.createDocumentFragment();

                var isRtl = this._isTableRtl(),
                    virtualRowXAttr = isRtl ? 'right' : 'left';

                for (var i = first, rowCount = rows.length, rowData, row, cell, cellInner, content;
                     i < rowCount && i <= last;
                     i++) {

                    rowData = rows[i];
                    physicalRowIndex = isDataFiltered ? rowData['__i'] : i;

                    row = createElement('div');
                    row.className = rowClassName;
                    row['rowIndex'] = i;
                    row['physicalRowIndex'] = physicalRowIndex;

                    for (colIndex = 0; colIndex < colCount; colIndex++) {
                        column = visibleColumns[colIndex];
                        cell = createElement('div');
                        cell['columnName'] = column.name;
						cell.setAttribute('data-column', column.name);
                        cell.className = cellClassName;
                        cell.style.width = column._finalWidth + 'px';
                        if (column.cellClasses) cell.className += ' ' + column.cellClasses;
                        if (allowCellPreview) {
                            this._bindCellHoverIn(cell);
                        }
                        cellInner = cell.appendChild(createElement('div'));
                        
                        dataPath = column.dataPath;
                        colValue = rowData[dataPath[0]];
                        for (dataPathIndex = 1; dataPathIndex < dataPath.length; dataPathIndex++) {
                            colValue = colValue && colValue[dataPath[dataPathIndex]];
                        }
                        
                        content = cellFormatter(colValue, column.name, rowData);
                        if (content === undefined) {
                            content = '';
                        }
                        cellInner.innerHTML = content;
                        row.appendChild(cell);
                    }

                    if (isVirtual) {
                        top = i > 0 ? virtualRowHeightFirst + (i - 1) * virtualRowHeight : 0;
                        row.style.position = 'absolute';
                        row.style[virtualRowXAttr] = 0;
                        row.style.top = top + 'px';
                    }

                    bodyFragment.appendChild(row);

                    that.trigger('rowcreate', i, physicalRowIndex, row, rowData);
                }

                return bodyFragment;
            },

            /**
             * Calculate virtual table height for scrollbar
             * @private
             * @returns {DGTable} self
             */
            _calculateVirtualHeight: function () {
                if (this._tbody) {
                    var rowCount = (this._filteredRows || this._rows).length;
                    var height = this._virtualRowHeight * rowCount;
                    if (rowCount) {
                        height += (this._virtualRowHeightFirst - this._virtualRowHeight);
                        height += (this._virtualRowHeightLast - this._virtualRowHeight);
                    }
                    // At least 1 pixel - to show scrollers correctly.
                    if (height < 1) {
                        height = 1;
                    }
                    this._tbody.style.height = height + 'px';
                }
                return this;
            },

            /**
             * Calculate the size required for the table body width (which is the row's width)
             * @private
             * @returns {Number} calculated width
             */
            _calculateTbodyWidth: function () {
                var that = this,
                    tableClassName = that.settings.tableClassName,
                    rowClassName = tableClassName + '-row',
                    cellClassName = tableClassName + '-cell',
                    visibleColumns = that._visibleColumns,
                    colCount = visibleColumns.length,
                    cell,
                    cellInner,
                    colIndex,
                    column;

                var $row = $('<div>').addClass(rowClassName).css('float', 'left');

                for (colIndex = 0; colIndex < colCount; colIndex++) {
                    column = visibleColumns[colIndex];
                    cell = createElement('div');
                    cell.className = cellClassName;
                    cell.style.width = column.actualWidth + 'px';
                    if (column.cellClasses) cell.className += ' ' + column.cellClasses;
                    cellInner = cell.appendChild(createElement('div'));
                    $row.append(cell);
                }

                var $thisWrapper = $('<div>')
                    .addClass(this.className)
                    .css({ 'z-index': -1, 'position': 'absolute', left: '0', top: '-9999px', 'float': 'left', width: '1px', overflow: 'hidden' })
                    .append(
                        $('<div>').addClass(tableClassName).append(
                            $('<div>').addClass(tableClassName + '-body').css('width', 99999).append(
                                $row
                            )
                        )
                    );

                $thisWrapper.appendTo(document.body);
                
                var fractionTest = $('<div style="border:1px solid #000;width:0;height:0;position:absolute;left:0;top:-9999px">').appendTo(document.body);
                var hasFractions = parseFloat(fractionTest.css('border-width'));
                hasFractions = Math.round(hasFractions) != hasFractions;
                fractionTest.remove();

                var width = $row.outerWidth();
                width -= this._scrollbarWidth || 0;
                
                if (hasFractions) {
                    width ++;
                }

                $thisWrapper.remove();
                return width;
            },

            /**
             * Add a column to the table
             * @public
             * @expose
             * @param {COLUMN_OPTIONS} columnData column properties
             * @param {String|Number} [before=-1] column name or order to be inserted before
             * @returns {DGTable} self
             */
            addColumn: function (columnData, before) {
                var columns = this._columns;

                if (columnData && !columns.get(columnData.name)) {
                    var beforeColumn = null;
                    if (before !== undefined) {
                        beforeColumn = columns.get(before) || columns.getByOrder(before);
                    }

                    var column = this._initColumnFromData(columnData);
                    column.order = beforeColumn ? beforeColumn.order : (columns.getMaxOrder() + 1);

                    for (var i = columns.getMaxOrder(), to = column.order, col; i >= to ; i--) {
                        col = columns.getByOrder(i);
                        if (col) {
                            col.order++;
                        }
                    }

                    columns.push(column);
                    columns.normalizeOrder();

                    this._tableSkeletonNeedsRendering = true;
                    this._visibleColumns = columns.getVisibleColumns();
                    this._ensureVisibleColumns();
                    this.render();

                    this.trigger('addcolumn', column.name);
                }
                return this;
            },

            /**
             * Remove a column from the table
             * @public
             * @expose
             * @param {String} column column name
             * @returns {DGTable} self
             */
            removeColumn: function (column) {
                var settings = this.settings, columns = this._columns;

                var colIdx = columns.indexOf(column);
                if (colIdx > -1) {
                    columns.splice(colIdx, 1);
                    columns.normalizeOrder();

                    this._visibleColumns = columns.getVisibleColumns();
                    this._ensureVisibleColumns().clearAndRender();

                    this.trigger('removecolumn', column);
                }
                return this;
            },

            /**
             * @public
             * @expose
             * @param {String} column Name of the column to filter on
             * @param {String} filter Check specified column for existence of this string
             * @param {Boolean} [caseSensitive=false] Use caseSensitive filtering
             * @returns {DGTable} self
             */
            filter: function (column, filter, caseSensitive) {
                var col = this._columns.get(column);
                if (col) {
                    var hasFilter = !!this._filteredRows;
                    if (this._filteredRows) {
                        this._filteredRows = null; // Release array memory
                    }
                    this._filteredRows = this._rows.filteredCollection(column, filter, caseSensitive);
                    if (hasFilter || this._filteredRows) {
                        this.clearAndRender();
                        this.trigger('filter', column, filter, caseSensitive);
                    }
                }
                return this;
            },

            /**
             * @private
             * @returns {DGTable} self
             */
            _refilter: function() {
                if (this._filteredRows) {
                    this._filteredRows = null; // Release memory
                    this._filteredRows = this._rows.filteredCollection(this._rows.filterColumn, this._rows.filterString, this._rows.filterCaseSensitive);
                }
                return this;
            },

            /**
             * Set a new label to a column
             * @public
             * @expose
             * @param {String} column Name of the column
             * @param {String} label New label for the column
             * @returns {DGTable} self
             */
            setColumnLabel: function (column, label) {
                var col = this._columns.get(column);
                if (col) {
                    col.label = label === undefined ? col.name : label;

                    if (col.element) {
                        for (var i = 0; i < col.element[0].firstChild.childNodes.length; i++) {
                            var node = col.element[0].firstChild.childNodes[i];
                            if(node.nodeType === 3) {
                                node.textContent = col.label;
                                break;
                            }
                        }
                    }
                }
                return this;
            },

            /**
             * Move a column to a new position
             * @public
             * @expose
             * @param {String|Number} src Name or position of the column to be moved
             * @param {String|Number} dest Name of the column currently in the desired position, or the position itself
             * @returns {DGTable} self
             */
            moveColumn: function (src, dest) {
                var settings = this.settings,
                    columns = this._columns,
                    col, destCol;
                if (typeof src === 'string') {
                    col = columns.get(src);
                } else if (typeof src === 'number') {
                    col = this._visibleColumns[src];
                }
                if (typeof dest === 'string') {
                    destCol = columns.get(dest);
                } else if (typeof dest === 'number') {
                    destCol = this._visibleColumns[dest];
                }

                if (col && destCol && src !== dest) {
                    var srcOrder = col.order, destOrder = destCol.order;

                    this._visibleColumns = columns.moveColumn(col, destCol).getVisibleColumns();
                    this._ensureVisibleColumns();

                    if (settings.virtualTable) {
                        this.clearAndRender()
                            ._updateLastCellWidthFromScrollbar(true);
                    } else {
                        var headerCell = this._$headerRow.find('>div.' + settings.tableClassName + '-header-cell');
                        var beforePos = srcOrder < destOrder ? destOrder + 1 : destOrder,
                            fromPos = srcOrder;
                        headerCell[0].parentNode.insertBefore(headerCell[fromPos], headerCell[beforePos]);

                        var srcWidth = this._visibleColumns[srcOrder];
                        srcWidth = (srcWidth.actualWidthConsideringScrollbarWidth || srcWidth.actualWidth) + 'px';
                        var destWidth = this._visibleColumns[destOrder];
                        destWidth = (destWidth.actualWidthConsideringScrollbarWidth || destWidth.actualWidth) + 'px';

                        var tbodyChildren = this._$tbody[0].childNodes;
                        for (var i = 0, count = tbodyChildren.length, row; i < count; i++) {
                            row = tbodyChildren[i];
                            if (row.nodeType !== 1) continue;
                            row.insertBefore(row.childNodes[fromPos], row.childNodes[beforePos]);
                            row.childNodes[destOrder].firstChild.style.width = destWidth;
                            row.childNodes[srcOrder].firstChild.style.width = srcWidth;
                        }
                    }

                    this.trigger('movecolumn', col.name, srcOrder, destOrder);
                }
                return this;
            },

            /**
             * Sort the table
             * @public
             * @expose
             * @param {String} column Name of the column to sort on
             * @param {Boolean=} descending Sort in descending order
             * @param {Boolean} [add=false] Should this sort be on top of the existing sort? (For multiple column sort)
             * @returns {DGTable} self
             */
            sort: function (column, descending, add) {
                var settings = this.settings,
                    columns = this._columns,
                    col = columns.get(column), i;
                if (col) {
                    var currentSort = this._rows.sortColumn;

                    if (currentSort.length && currentSort[currentSort.length - 1].column == column) {
                        // Recognize current descending mode, if currently sorting by this column
                        descending = descending === undefined ? !currentSort[currentSort.length - 1].descending : descending;
                    }

                    if (add) { // Add the sort to current sort stack

                        for (i = 0; i < currentSort.length; i++) {
                            if (currentSort[i].column == col.name) {
                                if (i < currentSort.length - 1) {
                                    currentSort.length = 0;
                                } else {
                                    currentSort.splice(currentSort.length - 1, 1);
                                }
                                break;
                            }
                        }
                        if ((settings.sortableColumns > 0 /* allow manual sort when disabled */ && currentSort.length >= settings.sortableColumns) || currentSort.length >= this._visibleColumns.length) {
                            currentSort.length = 0;
                        }

                    } else { // Sort only by this column
                        currentSort.length = 0;
                    }

                    // Default to ascending
                    descending = descending === undefined ? false : descending;

                    // Set the required column in the front of the stack
                    currentSort.push({
                        column: col.name,
                        comparePath: col.comparePath,
                        descending: !!descending
                    });

                    this._clearSortArrows();
                    for (i = 0; i < currentSort.length; i++) {
                        this._showSortArrow(currentSort[i].column, currentSort[i].descending);
                    }
                    if (settings.adjustColumnWidthForSortArrow && !settings._tableSkeletonNeedsRendering) {
                        this.tableWidthChanged(true);
                    }

                    if (settings.virtualTable) {
                        while (this._tbody && this._tbody.firstChild) {
                            this.trigger('rowdestroy', this._tbody.firstChild);
                            this._unbindCellEventsForRow(this._tbody.firstChild);
                            this._tbody.removeChild(this._tbody.firstChild);
                        }
                    } else {
                        this._tableSkeletonNeedsRendering = true;
                    }

                    this._rows.sortColumn = currentSort;
                    this._rows.sort(!!this._filteredRows);
                    this._refilter();

                    // Build output for event, with option names that will survive compilers
                    var sorts = [];
                    for (i = 0; i < currentSort.length; i++) {
                        sorts.push({ 'column': currentSort[i].column, 'descending': currentSort[i].descending });
                    }
                    this.trigger('sort', sorts);
                }
                return this;
            },

            /**
             * Re-sort the table using current sort specifiers
             * @public
             * @expose
             * @returns {DGTable} self
			 */
			resort: function () {
				var currentSort = this._rows.sortColumn;
				if (currentSort.length) {
                    this._rows.sortColumn = currentSort;
                    this._rows.sort(!!this._filteredRows);
                    this._refilter();

                    // Build output for event, with option names that will survive compilers
                    var sorts = [];
                    for (var i = 0; i < currentSort.length; i++) {
                        sorts.push({ 'column': currentSort[i].column, 'descending': currentSort[i].descending });
                    }
                    this.trigger('sort', sorts);
				}
				return this;
			},
			
            /**
             * Make sure there's at least one column visible
             * @private
             * @expose
             * @returns {DGTable} self
             */
            _ensureVisibleColumns: function () {
                if (this._visibleColumns.length === 0 && this._columns.length) {
                    this._columns[0].visible = true;
                    this._visibleColumns.push(this._columns[0]);
                    this.trigger('showcolumn', this._columns[0].name);
                }
                return this;
            },

            /**
             * Show or hide a column
             * @public
             * @expose
             * @param {String} column Unique column name
             * @param {Boolean} visible New visibility mode for the column
             * @returns {DGTable} self
             */
            setColumnVisible: function (column, visible) {
                var col = this._columns.get(column);
                if (col && !!col.visible != !!visible) {
                    col.visible = !!visible;
                    this._visibleColumns = this._columns.getVisibleColumns();
                    this.trigger(visible ? 'showcolumn' : 'hidecolumn', column);
                    this._ensureVisibleColumns();
                    this.clearAndRender();
                }
                return this;
            },

            /**
             * Get the visibility mode of a column
             * @public
             * @expose
             * @returns {Boolean} true if visible
             */
            isColumnVisible: function (column) {
                var col = this._columns.get(column);
                if (col) {
                    return col.visible;
                }
                return false;
            },

            /**
             * Globally set the minimum column width
             * @public
             * @expose
             * @param {Number} minColumnWidth Minimum column width
             * @returns {DGTable} self
             */
            setMinColumnWidth: function (minColumnWidth) {
                var settings = this.settings;
                minColumnWidth = Math.max(minColumnWidth, 0);
                if (settings.minColumnWidth != minColumnWidth) {
                    settings.minColumnWidth = minColumnWidth;
                    this.tableWidthChanged(true);
                }
                return this;
            },

            /**
             * Get the current minimum column width
             * @public
             * @expose
             * @returns {Number} Minimum column width
             */
            getMinColumnWidth: function () {
                return this.settings.minColumnWidth;
            },

            /**
             * Set the limit on concurrent columns sorted
             * @public
             * @expose
             * @param {Number} sortableColumns How many sortable columns to allow?
             * @returns {DGTable} self
             */
            setSortableColumns: function (sortableColumns) {
                var settings = this.settings;
                if (settings.sortableColumns != sortableColumns) {
                    settings.sortableColumns = sortableColumns;
                    if (this._$table) {
                        var headerCell = this._$headerRow.find('>div.' + settings.tableClassName + '-header-cell');
                        for (var i = 0; i < headerCell.length; i++) {
                            $(headerCell[0])[(settings.sortableColumns > 0 && this._visibleColumns[i].sortable) ? 'addClass' : 'removeClass']('sortable');
                        }
                    }
                }
                return this;
            },

            /**
             * Get the limit on concurrent columns sorted
             * @public
             * @expose
             * @returns {Number} How many sortable columns are allowed?
             */
            getSortableColumns: function () {
                return this.settings.sortableColumns;
            },

            /**
             * @public
             * @expose
             * @param {Boolean} movableColumns are the columns movable?
             * @returns {DGTable} self
             */
            setMovableColumns: function (movableColumns) {
                var settings = this.settings;
                movableColumns = !!movableColumns;
                if (settings.movableColumns != movableColumns) {
                    settings.movableColumns = movableColumns;
                }
                return this;
            },

            /**
             * @public
             * @expose
             * @returns {Boolean} are the columns movable?
             */
            getMovableColumns: function () {
                return this.settings.movableColumns;
            },

            /**
             * @public
             * @expose
             * @param {Boolean} resizableColumns are the columns resizable?
             * @returns {DGTable} self
             */
            setResizableColumns: function (resizableColumns) {
                var settings = this.settings;
                resizableColumns = !!resizableColumns;
                if (settings.resizableColumns != resizableColumns) {
                    settings.resizableColumns = resizableColumns;
                }
                return this;
            },

            /**
             * @public
             * @expose
             * @returns {Boolean} are the columns resizable?
             */
            getResizableColumns: function () {
                return this.settings.resizableColumns;
            },

            /**
             * @public
             * @expose
             * @param {Function(String,Boolean)Function(a,b)Boolean} comparatorCallback a callback function that returns the comparator for a specific column
             * @returns {DGTable} self
             */
            setComparatorCallback: function (comparatorCallback) {
                var settings = this.settings;
                if (settings.comparatorCallback != comparatorCallback) {
                    settings.comparatorCallback = comparatorCallback;
                }
                return this;
            },

            /**
             * Set a new width to a column
             * @public
             * @expose
             * @param {String} column name of the column to resize
             * @param {Number|String} width new column as pixels, or relative size (0.5, 50%)
             * @returns {DGTable} self
             */
            setColumnWidth: function (column, width) {

                var parsedWidth = this._parseColumnWidth(width, column.ignoreMin ? 0 : this.settings.minColumnWidth);

                var col = this._columns.get(column);
                if (col) {
                    var oldWidth = this._serializeColumnWidth(col);

                    col.width = parsedWidth.width;
                    col.widthMode = parsedWidth.mode;

                    var newWidth = this._serializeColumnWidth(col);

                    if (oldWidth != newWidth) {
                        this.tableWidthChanged(true); // Calculate actual sizes
                    }

                    this.trigger('columnwidth', col.name, oldWidth, newWidth);
                }
                return this;
            },

            /**
             * @public
             * @expose
             * @param {String} column name of the column
             * @returns {String|null} the serialized width of the specified column, or null if column not found
             */
            getColumnWidth: function (column) {
                var col = this._columns.get(column);
                if (col) {
                    return this._serializeColumnWidth(col);
                }
                return null;
            },

            /**
             * @public
             * @expose
             * @param {String} column name of the column
             * @returns {SERIALIZED_COLUMN} configuration for all columns
             */
            getColumnConfig: function (column) {
                var col = this._columns.get(column);
                if (col) {
                    return {
                        'order': col.order,
                        'width': this._serializeColumnWidth(col),
                        'visible': col.visible,
                        'label': col.label
                    };
                }
                return null;
            },

            /**
             * Returns a config object for the columns, to allow saving configurations for next time...
             * @public
             * @expose
             * @returns {Object} configuration for all columns
             */
            getColumnsConfig: function () {
                var config = {};
                for (var i = 0; i < this._columns.length; i++) {
                    config[this._columns[i].name] = this.getColumnConfig(this._columns[i].name);
                }
                return config;
            },

            /**
             * Returns an array of the currently sorted columns
             * @public
             * @expose
             * @returns {Array.<SERIALIZED_COLUMN_SORT>} configuration for all columns
             */
            getSortedColumns: function () {
                var sorted = [];
                for (var i = 0, sort; i < this._rows.sortColumn.length; i++) {
                    sort = this._rows.sortColumn[i];
                    sorted.push({column: sort.column, descending: sort.descending});
                }
                return sorted;
            },

            /**
             * Returns the HTML string for a specific cell. Can be used externally for special cases (i.e. when setting a fresh HTML in the cell preview through the callback).
             * @public
             * @expose
             * @param {Number} row index of the row
             * @param {String} column name of the column
             * @returns {String} HTML string for the specified cell
             */
            getHtmlForCell: function (row, columnName) {
                if (row < 0 || row > this._rows.length - 1) return null;
                var column = this._columns.get(columnName);
                if (!column) return null;
                var rowData = this._rows[row];
        
                var dataPath = column.dataPath;
                var colValue = rowData[dataPath[0]];
                for (var dataPathIndex = 1; dataPathIndex < dataPath.length; dataPathIndex++) {
                    colValue = colValue[dataPath[dataPathIndex]];
                }
                
                var content = this.settings.cellFormatter(colValue, column.name, rowData);
                if (content === undefined) {
                    content = '';
                }
                return content;
            },

            /**
             * Returns the row data for a specific row
             * @public
             * @expose
             * @param {Number} row index of the row
             * @returns {Object} Row data
             */
            getDataForRow: function (row) {
                if (row < 0 || row > this._rows.length - 1) return null;
                return this._rows[row];
            },

            /**
             * Gets the number of rows
             * @public
             * @expose
             * @returns {Number} Row count
             */
            getRowCount: function () {
                return this._rows ? this._rows.length : 0;
            },

            /**
             * Returns the row data for a specific row
             * @public
             * @expose
             * @param {Number} row index of the filtered row
             * @returns {Object} Row data
             */
            getDataForFilteredRow: function (row) {
                if (row < 0 || row > (this._filteredRows || this._rows).length - 1) return null;
                return (this._filteredRows || this._rows)[row];
            },

            /**
             * Returns DOM element of the header row
             * @public
             * @expose
             * @returns {Element} Row element
             */
            getHeaderRowElement: function () {
                return this._headerRow;
            },

            /**
             * @private
             * @param {Element} el
             * @returns {Number} width
             */
            _horizontalPadding: function(el) {
                return ((parseFloat($.css(el, 'padding-left')) || 0) +
                    (parseFloat($.css(el, 'padding-right')) || 0));
            },

            /**
             * @private
             * @param {Element} el
             * @returns {Number} width
             */
            _horizontalBorderWidth: function(el) {
                return ((parseFloat($.css(el, 'border-left')) || 0) +
                    (parseFloat($.css(el, 'border-right')) || 0));
            },

            /**
             * @private
             * @returns {Number} width
             */
            _calculateWidthAvailableForColumns: function() {
                var settings = this.settings;

                // Changing display mode briefly, to prevent taking in account the  parent's scrollbar width when we are the cause for it
                var oldDisplay, lastScrollTop, lastScrollLeft;
                if (this._$table) {
                    lastScrollTop = this._table ? this._table.scrollTop : 0;
                    lastScrollLeft = this._table ? this._table.scrollLeft : 0;
                    
                    if (settings.virtualTable) {
                        oldDisplay = this._$table[0].style.display;
                        this._$table[0].style.display = 'none';
                    }
                }
                var detectedWidth = this.$el.width();
                if (this._$table) {
                    if (settings.virtualTable) {
                        this._$table[0].style.display = oldDisplay;
                    }

                    this._table.scrollTop = lastScrollTop;
                    this._table.scrollLeft = lastScrollLeft;
                    this._header.scrollLeft = lastScrollLeft;
                }

                var $thisWrapper, $header, $headerRow;
                var tableClassName = settings.tableClassName;

                if (!this._$table) {

                    $thisWrapper = $('<div>').addClass(this.className).css({ 'z-index': -1, 'position': 'absolute', left: '0', top: '-9999px' });
                    $header = $('<div>').addClass(tableClassName + '-header').appendTo($thisWrapper);
                    $headerRow = $('<div>').addClass(tableClassName + '-header-row').appendTo($header);
                    for (var i = 0; i < this._visibleColumns.length; i++) {
                        $headerRow.append($('<div><div></div></div>').addClass(tableClassName + '-header-cell').addClass(this._visibleColumns[i].cellClasses || ''));
                    }
                    $thisWrapper.appendTo(document.body);
                } else {
                    $headerRow = this._$headerRow;
                }

                detectedWidth -= this._horizontalBorderWidth($headerRow[0]);
                var $cells = $headerRow.find('>div.' + tableClassName + '-header-cell');
                for (var i = 0, $cell, $div, cellBorderBox; i < $cells.length; i++) {
                    $div = $($cells[i].firstChild);
                    $cell = $($cells[i]);

                    cellBorderBox = $cell.css('boxSizing') === 'border-box';
                    detectedWidth -=
                        (parseFloat($cell.css('border-right-width')) || 0) +
                        (parseFloat($cell.css('border-left-width')) || 0) +
                        (cellBorderBox ? 0 : this._horizontalPadding($cell[0])); // CELL's padding
                }

                if ($thisWrapper) {
                    $thisWrapper.remove();
                }

                return detectedWidth;
            },

            /**
             * Notify the table that its width has changed
             * @public
             * @expose
             * @returns {DGTable} self
             */
            tableWidthChanged: (function () {

                var getTextWidth = function(text) {
                    var tableClassName = this.settings.tableClassName;

                    var $cell, $tableWrapper = $('<div>').addClass(this.$el).append(
                        $('<div>').addClass(tableClassName + '-header').append(
                            $('<div>').addClass(tableClassName + '-header-row').append(
                                $cell = $('<div>').addClass(tableClassName + '-header-cell').append(
                                    $('<div>').text(text)
                                )
                            )
                        )
                    ).css({'position': 'absolute', top: '-9999px', 'visibility': 'hidden'});
                    $tableWrapper.appendTo(document.body);
                    var width = $cell.width();
                    $tableWrapper.remove();
                    return width;
                };
                
                var lastDetectedWidth = null;
                
                /**
                 * @public
                 * @param {Boolean} [forceUpdate=false]
                 * @param {Boolean} [renderColumns=true]
                 * @returns {DGTable} self
                 */
                return function(forceUpdate, renderColumns) {

                    var settings = this.settings,
                        detectedWidth = this._calculateWidthAvailableForColumns(),
                        sizeLeft = detectedWidth,
                        relatives = 0;

                    renderColumns = renderColumns === undefined || renderColumns;

                    var tableWidthBeforeCalculations = 0;

					if (!this._tbody) {
						renderColumns = false;
					}
					
                    if (renderColumns) {
                        tableWidthBeforeCalculations = parseFloat(this._tbody.style.minWidth) || 0;
                    }

                    if (sizeLeft != lastDetectedWidth || forceUpdate) {
                        lastDetectedWidth = detectedWidth;

                        var width, absWidthTotal = 0, changedColumnIndexes = [], i, col, totalRelativePercentage = 0;

                        for (i = 0; i < this._columns.length; i++) {
                            this._columns[i].actualWidthConsideringScrollbarWidth = null;
                        }

                        for (i = 0; i < this._visibleColumns.length; i++) {
                            col = this._visibleColumns[i];
                            if (col.widthMode === COLUMN_WIDTH_MODE.ABSOLUTE) {
                                width = col.width;
                                width += col.arrowProposedWidth || 0; // Sort-arrow width
                                if (!col.ignoreMin && width < settings.minColumnWidth) {
                                    width = settings.minColumnWidth;
                                }
                                sizeLeft -= width;
                                absWidthTotal += width;

                                // Update actualWidth
                                if (width !== col.actualWidth) {
                                    col.actualWidth = width;
                                    changedColumnIndexes.push(i);
                                }
                            } else if (col.widthMode === COLUMN_WIDTH_MODE.AUTO) {
                                width = getTextWidth.call(this, col.label) + 20;
                                width += col.arrowProposedWidth || 0; // Sort-arrow width
                                if (!col.ignoreMin && width < settings.minColumnWidth) {
                                    width = settings.minColumnWidth;
                                }
                                sizeLeft -= width;
                                absWidthTotal += width;

                                // Update actualWidth
                                if (width !== col.actualWidth) {
                                    col.actualWidth = width;
                                    if (!settings.convertColumnWidthsToRelative) {
                                        changedColumnIndexes.push(i);
                                    }
                                }
                            } else if (col.widthMode === COLUMN_WIDTH_MODE.RELATIVE) {
                                totalRelativePercentage += col.width;
                                relatives++;
                            }
                        }

                        // Normalize relative sizes if needed
                        if (settings.convertColumnWidthsToRelative) {
                            for (i = 0; i < this._visibleColumns.length; i++) {
                                col = this._visibleColumns[i];
                                if (col.widthMode === COLUMN_WIDTH_MODE.AUTO) {
                                    col.widthMode = COLUMN_WIDTH_MODE.RELATIVE;
                                    sizeLeft += col.actualWidth;
                                    col.width = col.actualWidth / absWidthTotal;
                                    totalRelativePercentage += col.width;
                                    relatives++;
                                }
                            }
                        }

                        // Normalize relative sizes if needed
                        if (relatives && ((totalRelativePercentage < 1 && settings.relativeWidthGrowsToFillWidth) ||
                                        (totalRelativePercentage > 1 && settings.relativeWidthShrinksToFillWidth))) {
                            for (i = 0; i < this._visibleColumns.length; i++) {
                                col = this._visibleColumns[i];
                                if (col.widthMode === COLUMN_WIDTH_MODE.RELATIVE) {
                                    col.width /= totalRelativePercentage;
                                }
                            }
                        }

                        detectedWidth = sizeLeft; // Use this as the space to take the relative widths out of

                        var minColumnWidthRelative = (settings.minColumnWidth / detectedWidth);
                        if (isNaN(minColumnWidthRelative)) {
                            minColumnWidthRelative = 0;
                        }
                        if (minColumnWidthRelative > 0) {
                            var extraRelative = 0, delta;

                            // First pass - make sure they are all constrained to the minimum width
                            for (i = 0; i < this._visibleColumns.length; i++) {
                                col = this._visibleColumns[i];
                                if (col.widthMode === COLUMN_WIDTH_MODE.RELATIVE) {
                                    if (!col.ignoreMin && col.width < minColumnWidthRelative) {
                                        extraRelative += minColumnWidthRelative - col.width;
                                        col.width = minColumnWidthRelative;
                                    }
                                }
                            }

                            // Second pass - try to take the extra width out of the other columns to compensate
                            for (i = 0; i < this._visibleColumns.length; i++) {
                                col = this._visibleColumns[i];
                                if (col.widthMode === COLUMN_WIDTH_MODE.RELATIVE) {
                                    if (!col.ignoreMin && col.width > minColumnWidthRelative) {
                                        if (extraRelative > 0) {
                                            delta = Math.min(extraRelative, col.width - minColumnWidthRelative);
                                            col.width -= delta;
                                            extraRelative -= delta;
                                        }
                                    }
                                }
                            }
                        }

                        for (i = 0; i < this._visibleColumns.length; i++) {
                            col = this._visibleColumns[i];
                            if (col.widthMode === COLUMN_WIDTH_MODE.RELATIVE) {
                                width = Math.round(detectedWidth * col.width);
                                sizeLeft -= width;
                                relatives--;

                                // Take care of rounding errors
                                if (relatives === 0 && sizeLeft === 1) { // Take care of rounding errors
                                    width++;
                                    sizeLeft--;
                                }
                                if (sizeLeft === -1) {
                                    width--;
                                    sizeLeft++;
                                }

                                // Update actualWidth
                                if (width !== col.actualWidth) {
                                    col.actualWidth = width;
                                    changedColumnIndexes.push(i);
                                }
                            }
                        }

                        this._visibleColumns[this._visibleColumns.length - 1].actualWidthConsideringScrollbarWidth = this._visibleColumns[this._visibleColumns.length - 1].actualWidth - (this._scrollbarWidth || 0);

                        if (renderColumns) {
                            var tableWidth = this._calculateTbodyWidth();

                            if (tableWidthBeforeCalculations < tableWidth) {
                                this._updateTableWidth(false);
                            }

                            for (i = 0; i < changedColumnIndexes.length; i++) {
                                this._resizeColumnElements(changedColumnIndexes[i]);
                            }

                            if (tableWidthBeforeCalculations > tableWidth) {
                                this._updateTableWidth(false);
                            }
                        }
                    }
                    
                    return this;
                };
            })(),

            /**
             * Notify the table that its height has changed
             * @public
             * @expose
             * @returns {DGTable} self
             */
            tableHeightChanged: function () {
                var that = this,
                    settings = that.settings;
                if (!that._$table) {
                    return that;
                }
                var height = that.$el.innerHeight() - (parseFloat(that._$table.css('border-top-width')) || 0) - (parseFloat(this._$table.css('border-bottom-width')) || 0);
                if (height != settings.height) {
                    settings.height = height;
                    if (that._tbody) {
                        // At least 1 pixel - to show scrollers correctly.
                        that._tbody.style.height = Math.max(settings.height - that._$headerRow.outerHeight(), 1) + 'px';
                    }
                    if (settings.virtualTable) {
                        that.clearAndRender();
                    }
                }
                return that;
            },

            /**
             * Add rows to the table
             * @public
             * @expose
             * @param {Object[]} data array of rows to add to the table
             * @param {Boolean?} resort should resort all rows?
             * @returns {DGTable} self
             */
            addRows: function (data, resort) {
                var that = this;
                if (data) {
                    this._rows.add(data);
                    if (that.settings.virtualTable) {
                        while (this._tbody.firstChild) {
                            this.trigger('rowdestroy', this._tbody.firstChild);
                            this._unbindCellEventsForRow(this._tbody.firstChild);
                            this._tbody.removeChild(this._tbody.firstChild);
                        }

						if (resort && this._rows.sortColumn.length) {
							this.resort();
						} else {
							this._refilter();
						}

                        this._calculateVirtualHeight() // Calculate virtual height
                            ._updateLastCellWidthFromScrollbar() // Detect vertical scrollbar height
                            ._updateTableWidth(false); // Update table width to suit the required width considering vertical scrollbar

                        this.render();
                    } else {
                        if (this._filteredRows) {
                            var filteredCount = this._filteredRows.length;
                            this._refilter();
                            if (!this._filteredRows || this._filteredRows.length != filteredCount) {
                                this.clearAndRender();
                            }
                        } else if (this._$tbody) {
                            var firstRow = that._rows.length - data.length,
                                lastRow = firstRow + data.length - 1;

                            var renderedRows = that.renderRows(firstRow, lastRow);
                            that._tbody.appendChild(renderedRows);
                            that._updateLastCellWidthFromScrollbar() // Detect vertical scrollbar height, and update existing last cells
                                ._updateTableWidth(true); // Update table width to suit the required width considering vertical scrollbar
                        }
                    }
                    this.trigger('addrows', data.length, false);
                }
                return this;
            },

            /**
             * Removes a row from the table
             * @public
             * @expose
             * @param {Number} physicalRowIndex index
             * @param {Boolean=true} render
             * @returns {DGTable} self
             */
            removeRow: function(physicalRowIndex, render) {
                if (physicalRowIndex < 0 || physicalRowIndex > this._rows.length - 1) return this;

                this._rows.splice(physicalRowIndex, 1);
                render = (render === undefined) ? true : !!render;
                if (this._filteredRows) {
                    this._refilter();
                    this._tableSkeletonNeedsRendering = true;
                    if (render) {
                        // Render the skeleton with all rows from scratch
                        this.render();
                    }
                } else if (render) {
                    var childNodes = this._tbody.childNodes;
                    if (this.settings.virtualTable) {
                        for (var i = 0; i < childNodes.length; i++) {
                            if (childNodes[i]['rowIndex'] >= physicalRowIndex) {
                                this.trigger('rowdestroy', childNodes[i]);
                                this._unbindCellEventsForRow(childNodes[i]);
                                this._tbody.removeChild(childNodes[i]);

                                // Keep on destroying all rows further, and later render them all back.
                                // Because f we have a hole in the middle, it will be harder to shift the rest of the rows and re-render
                                i--;
                            }
                        }
                        this._calculateVirtualHeight()
                            ._updateLastCellWidthFromScrollbar()
                            .render()
                            ._updateTableWidth(false); // Update table width to suit the required width considering vertical scrollbar
                    } else {
                        for (var i = 0; i < childNodes.length; i++) {
                            if (childNodes[i]['rowIndex'] === physicalRowIndex) {
                                this.trigger('rowdestroy', childNodes[i]);
                                this._unbindCellEventsForRow(childNodes[i]);
                                this._tbody.removeChild(childNodes[i]);
                                break;
                            }
                        }
                        this.render()
                            ._updateLastCellWidthFromScrollbar()
                            ._updateTableWidth(true); // Update table width to suit the required width considering vertical scrollbar
                    }
                }
                return this;
            },

            /**
             * Refreshes the row specified
             * @public
             * @expose
             * @param {Number} physicalRowIndex index
             * @returns {DGTable} self
             */
            refreshRow: function(physicalRowIndex) {
                if (physicalRowIndex < 0 || physicalRowIndex > this._rows.length - 1) return this;

                // Find out if the row is in the rendered dataset
                var rowIndex = -1;
                if (this._filteredRows && (rowIndex = _.indexOf(this._filteredRows, this._rows[physicalRowIndex])) === -1) return this;

                if (rowIndex === -1) {
                    rowIndex = physicalRowIndex;
                }

                var childNodes = this._tbody.childNodes;

                if (this.settings.virtualTable) {
                    // Now make sure that the row actually rendered, as this is a virtual table
                    var isRowVisible = false;
                    for (var i = 0; i < childNodes.length; i++) {
                        if (childNodes[i]['physicalRowIndex'] === physicalRowIndex) {
                            isRowVisible = true;
                            this.trigger('rowdestroy', childNodes[i]);
                            this._unbindCellEventsForRow(childNodes[i]);
                            this._tbody.removeChild(childNodes[i]);
                            break;
                        }
                    }
                    if (isRowVisible) {
                        var renderedRow = this.renderRows(rowIndex, rowIndex);
                        this._tbody.insertBefore(renderedRow, childNodes[i] || null);
                    }
                } else {
                    this.trigger('rowdestroy', childNodes[rowIndex]);
                    this._unbindCellEventsForRow(childNodes[rowIndex]);
                    this._tbody.removeChild(childNodes[rowIndex]);
                    var renderedRow = this.renderRows(rowIndex, rowIndex);
                    this._tbody.insertBefore(renderedRow, childNodes[rowIndex] || null);
                }

                return this;
            },

            /**
             * Get the DOM element for the specified row, if it exists
             * @public
             * @expose
             * @param {Number} physicalRowIndex index
             * @returns {Element?} row or null
             */
            getRowElement: function(physicalRowIndex) {
                if (physicalRowIndex < 0 || physicalRowIndex > this._rows.length - 1) return null;

                // Find out if the row is in the rendered dataset
                var rowIndex = -1;
                if (this._filteredRows && (rowIndex = _.indexOf(this._filteredRows, this._rows[physicalRowIndex])) === -1) return this;

                if (rowIndex === -1) {
                    rowIndex = physicalRowIndex;
                }

                var childNodes = this._tbody.childNodes;

                if (this.settings.virtualTable) {
                    // Now make sure that the row actually rendered, as this is a virtual table
                    for (var i = 0; i < childNodes.length; i++) {
                        if (childNodes[i]['physicalRowIndex'] === physicalRowIndex) {
                            return childNodes[i];
                        }
                    }
                } else {
                    return childNodes[rowIndex];
                }

                return null;
            },

            /**
             * Refreshes all virtual rows
             * @public
             * @expose
             * @returns {DGTable} self
             */
			refreshAllVirtualRows: function () {

                if (this.settings.virtualTable) {
                    // Now make sure that the row actually rendered, as this is a virtual table
                    var isRowVisible = false;
					var rowsToRender = [];
					var childNodes = this._tbody.childNodes;
                    for (var i = 0, rowCount = childNodes.length; i < rowCount; i++) {
						rowsToRender.push(childNodes[i]['physicalRowIndex']);
						this.trigger('rowdestroy', childNodes[i]);
						this._unbindCellEventsForRow(childNodes[i]);
						this._tbody.removeChild(childNodes[i]);
						i--;
						rowCount--;
                    }
                    for (var i = 0; i < rowsToRender.length; i++) {
                        var renderedRow = this.renderRows(rowsToRender[i], rowsToRender[i]);
                        this._tbody.appendChild(renderedRow);
					}
                }

                return this;
			},
			
            /**
             * Replace the whole dataset
             * @public
             * @expose
             * @param {Object[]} data array of rows to add to the table
             * @param {Boolean?} resort should resort all rows?
             * @returns {DGTable} self
             */
            setRows: function (data, resort) {
                this.scrollTop = this.$el.find('.table').scrollTop();
                this._rows.reset(data);
				if (resort && this._rows.sortColumn.length) {
					this.resort();
				} else {
					this._refilter();
				}
                this.clearAndRender().trigger('addrows', data.length, true);
                return this;
            },

            /**
             * Creates a URL representing the data in the specified element.
             * This uses the Blob or BlobBuilder of the modern browsers.
             * The url can be used for a Web Worker.
             * @public
             * @expose
             * @param {string} id Id of the element containing your data
             * @returns {string?} the url, or null if not supported
             */
            getUrlForElementContent: function (id) {
                var blob,
                    el = document.getElementById(id);
                if (el) {
                    var data = el.textContent;
                    if (typeof Blob === 'function') {
                        blob = new Blob([data]);
                    } else {
                        var BlobBuilder = global.BlobBuilder || global.WebKitBlobBuilder || global.MozBlobBuilder || global.MSBlobBuilder;
                        if (!BlobBuilder) {
                            return null;
                        }
                        var builder = new BlobBuilder();
                        builder.append(data);
                        blob = builder.getBlob();
                    }
                    return (global.URL || global.webkitURL).createObjectURL(blob);
                }
                return null;
            },

            /**
             * @public
             * @expose
             * @returns {Boolean} A value indicating whether Web Workers are supported
             */
            isWorkerSupported: function() {
                return global['Worker'] instanceof Function;
            },

            /**
             * Creates a Web Worker for updating the table.
             * @public
             * @expose
             * @param {string} url Url to the script for the Web Worker
             * @param {Boolean=true} start if true, starts the Worker immediately
             * @returns {Worker?} the Web Worker, or null if not supported
             */
            createWebWorker: function (url, start, resort) {
                if (this.isWorkerSupported()) {
                    var that = this;
                    var worker = new Worker(url);
                    var listener = function (evt) {
                        if (evt.data.append) {
                            that.addRows(evt.data.rows, resort);
                        } else {
                            that.setRows(evt.data.rows, resort);
                        }
                    };
                    worker.addEventListener('message', listener, false);
                    if (!this._workerListeners) {
                        this._workerListeners = [];
                    }
                    this._workerListeners.push({worker: worker, listener: listener});
                    if (start || start === undefined) {
                        worker.postMessage(null);
                    }
                    return worker;
                }
                return null;
            },

            /**
             * Unbinds a Web Worker from the table, stopping updates.
             * @public
             * @expose
             * @param {Worker} worker the Web Worker
             * @returns {DGTable} self
             */
            unbindWebWorker: function (worker) {
                if (this._workerListeners) {
                    for (var j = 0; j < this._workerListeners.length; j++) {
                        if (this._workerListeners[j].worker == worker) {
                            worker.removeEventListener('message', this._workerListeners[j].listener, false);
                            this._workerListeners.splice(j, 1);
                            j--;
                        }
                    }
                }
                return this;
            },

            /**
             * A synonym for hideCellPreview()
             * @expose
             * @public
             * @returns {DGTable} self
             */
            abortCellPreview: function() {
                this.hideCellPreview();
                return this;
            },

            /**
             * Cancel a resize in progress
             * @expose
             * @private
             * @returns {DGTable} self
             */
            cancelColumnResize: function() {
                if (this._$resizer) {
                    this._$resizer.remove();
                    this._$resizer = null;
                    $(document).off('mousemove.dgtable', this._onMouseMoveResizeAreaBound)
                        .off('mouseup.dgtable', this._onEndDragColumnHeaderBound);
                }
                return this;
            },

            /**
             * @param {jQuery.Event} event
             */
            _onVirtualTableScrolled: function (event) {
                this.render();
            },

            /**
             * @param {jQuery.Event} event
             */
            _onTableScrolledHorizontally: function (event) {
                this._header.scrollLeft = this._table.scrollLeft;
            },

            /**previousElementSibling
             * Reverse-calculate the column to resize from mouse position
             * @private
             * @param {jQuery.Event} e jQuery mouse event
             * @returns {String} name of the column which the mouse is over, or null if the mouse is not in resize position
             */
            _getColumnByResizePosition: function (e) {

                var settings = this.settings,
                    rtl = this._isTableRtl();

                var $headerCell = $(e.target).closest('div.' + settings.tableClassName + '-header-cell,div.' + settings.cellPreviewClassName),
                    headerCell = $headerCell[0];
                if (headerCell['__cell']) {
                    headerCell = headerCell['__cell'];
                    $headerCell = $(headerCell);
                }

                var previousElementSibling = $headerCell[0].previousSibling;
                while (previousElementSibling && previousElementSibling.nodeType != 1) {
                    previousElementSibling = previousElementSibling.previousSibling;
                }

                var firstCol = !previousElementSibling;

                var mouseX = ((e.pageX != null ? e.pageX : e.originalEvent.pageX) || e.originalEvent.clientX) - $headerCell.offset().left;

                if (rtl) {
                    if (!firstCol && $headerCell.outerWidth() - mouseX <= settings.resizeAreaWidth / 2) {
                        return previousElementSibling['columnName'];
                    } else if (mouseX <= settings.resizeAreaWidth / 2) {
                        return headerCell['columnName'];
                    }
                } else {
                    if (!firstCol && mouseX <= settings.resizeAreaWidth / 2) {
                        return previousElementSibling['columnName'];
                    } else if ($headerCell.outerWidth() - mouseX <= settings.resizeAreaWidth / 2) {
                        return headerCell['columnName'];
                    }
                }

                return null;
            },

            /**
             * @param {jQuery.Event} e event
             */
            _onTouchStartColumnHeader: function (event) {
                var that = this;
                if (that._currentTouchId) return;

                var startTouch = event.originalEvent.changedTouches[0];
                that._currentTouchId = startTouch.identifier;

                var $eventTarget = $(event.currentTarget);

                var startPos = { x: startTouch.pageX, y: startTouch.pageY },
                    currentPos = startPos,
                    distanceTreshold = 9;

                var unbind = function () {
                    that._currentTouchId = null;
                    $eventTarget.off('touchend').off('touchcancel');
                    clearTimeout(tapAndHoldTimeout);
                };

                var fakeEvent = function (name) {
                    var fakeEvent = $.Event(name);
                    var extendObjects = Array.prototype.slice.call(arguments, 1);
                    $.each(['target', 'clientX', 'clientY', 'offsetX', 'offsetY', 'screenX', 'screenY', 'pageX', 'pageY', 'which'],
                        function () {
                            fakeEvent[this] = event[this];
                            for (var i = 0; i < extendObjects.length; i++) {
                                if (extendObjects[i][this] != null) {
                                    fakeEvent[this] = extendObjects[i][this];
                                }
                            }
                        });
                    return fakeEvent;
                };

                $eventTarget.trigger(fakeEvent('mousedown', event.originalEvent.changedTouches[0], { 'which': 1 }));

                var tapAndHoldTimeout = setTimeout(function () {
                    unbind();

                    // Prevent simulated mouse events after touchend
                    $eventTarget.one('touchend', function (event) {
                        event.preventDefault();
                        $eventTarget.off('touchend').off('touchcancel');
                    }).one('touchcancel', function (event) {
                        $eventTarget.off('touchend').off('touchcancel');
                    });

                    var distanceTravelled = Math.sqrt(Math.pow(Math.abs(currentPos.x - startPos.x), 2) + Math.pow(Math.abs(currentPos.y - startPos.y), 2));

                    if (distanceTravelled < distanceTreshold) {
                        that.cancelColumnResize();
                        $eventTarget.trigger(fakeEvent('mouseup', event.originalEvent.changedTouches[0], { 'which': 3 }));
                    }

                }, 500);

                $eventTarget.on('touchend', function (event) {
                    var touch = _.find(event.originalEvent.changedTouches, function(touch){ return touch.identifier === that._currentTouchId; });
                    if (!touch) return;

                    unbind();

                    event.preventDefault(); // Prevent simulated mouse events

                    currentPos = { x: touch.pageX, y: touch.pageY };
                    var distanceTravelled = Math.sqrt(Math.pow(Math.abs(currentPos.x - startPos.x), 2) + Math.pow(Math.abs(currentPos.y - startPos.y), 2));

                    if (distanceTravelled < distanceTreshold || that._$resizer) {
                        $eventTarget.trigger(fakeEvent('mouseup', touch, { 'which': 1 }));
                        $eventTarget.trigger(fakeEvent('click', touch, { 'which': 1 }));
                    }

                }).on('touchcancel', function () {
                    unbind();
                }).on('touchmove', function (event) {
                    var touch = _.find(event.originalEvent.changedTouches, function (touch) {
                        return touch.identifier === that._currentTouchId;
                    });
                    if (!touch) return;

                    // Keep track of current position, so we know if we need to cancel the tap-and-hold
                    currentPos = { x: touch.pageX, y: touch.pageY };

                    if (that._$resizer) {
                        event.preventDefault();

                        $eventTarget.trigger(fakeEvent('mousemove', touch));
                    }
                });
            },

            /**
             * @param {jQuery.Event} e event
             */
            _onMouseDownColumnHeader: function (event) {
                if (event.which !== 1) return this; // Only treat left-clicks

                var settings = this.settings,
                    col = this._getColumnByResizePosition(event);
                if (col) {
                    var column = this._columns.get(col);
                    if (!settings.resizableColumns || !column || !column.resizable) {
                        return false;
                    }

                    var rtl = this._isTableRtl();

                    if (this._$resizer) {
                        $(this._$resizer).remove();
                    }
                    this._$resizer = $('<div></div>')
                        .addClass(settings.resizerClassName)
                        .css({
                            'position': 'absolute',
                            'display': 'block',
                            'z-index': -1,
                            'visibility': 'hidden',
                            'width': '2px',
                            'background': '#000',
                            'opacity': 0.7
                        })
                        .appendTo(this.$el);

                    var selectedHeaderCell = column.element,
                        commonAncestor = this._$resizer.parent();

                    var posCol = selectedHeaderCell.offset(),
                        posRelative = commonAncestor.offset();
                    if (ieVersion === 8) {
                        posCol = selectedHeaderCell.offset(); // IE8 bug, first time it receives zeros...
                    }
                    posRelative.left += parseFloat(commonAncestor.css('border-left-width')) || 0;
                    posRelative.top += parseFloat(commonAncestor.css('border-top-width')) || 0;
                    posCol.left -= posRelative.left;
                    posCol.top -= posRelative.top;
                    posCol.top -= parseFloat(selectedHeaderCell.css('border-top-width')) || 0;
                    var resizerWidth = this._$resizer.outerWidth();
                    if (rtl) {
                        posCol.left -= Math.ceil((parseFloat(selectedHeaderCell.css('border-left-width')) || 0) / 2);
                        posCol.left -= Math.ceil(resizerWidth / 2);
                    } else {
                        posCol.left += selectedHeaderCell.outerWidth();
                        posCol.left += Math.ceil((parseFloat(selectedHeaderCell.css('border-right-width')) || 0) / 2);
                        posCol.left -= Math.ceil(resizerWidth / 2);
                    }

                    this._$resizer
                        .css({
                            'z-index': '10',
                            'visibility': 'visible',
                            'left': posCol.left,
                            'top': posCol.top,
                            'height': this.$el.height()
                        })
                        [0]['columnName'] = selectedHeaderCell[0]['columnName'];
                    try { this._$resizer[0].style.zIndex = ''; } catch (err) { }

                    $(document).on('mousemove.dgtable', this._onMouseMoveResizeAreaBound);
                    $(document).on('mouseup.dgtable', this._onEndDragColumnHeaderBound);

                    event.preventDefault();
                }
            },

            /**
             * @param {jQuery.Event} event event
             */
            _onMouseMoveColumnHeader: function (event) {
                var settings = this.settings;
                if (settings.resizableColumns) {
                    var col = this._getColumnByResizePosition(event);
                    var headerCell = $(event.target).closest('div.' + settings.tableClassName + '-header-cell,div.' + settings.cellPreviewClassName)[0];
                    if (!col || !this._columns.get(col).resizable) {
                        headerCell.style.cursor = '';
                    } else {
                        headerCell.style.cursor = 'e-resize';
                    }
                }
            },

            /**
             * @param {jQuery.Event} e event
             */
            _onMouseUpColumnHeader: function (event) {
                if (event.which === 3) {
                    var settings = this.settings;
                    var $headerCell = $(event.target).closest('div.' + settings.tableClassName + '-header-cell,div.' + settings.cellPreviewClassName);
                    var bounds = $headerCell.offset();
                    bounds['width'] = $headerCell.outerWidth();
                    bounds['height'] = $headerCell.outerHeight();
                    this.trigger('headercontextmenu', $headerCell[0]['columnName'], event.pageX, event.pageY, bounds);
                }
                return this;
            },

            /**
             * @private
             * @param {jQuery.Event} event event
             */
            _onMouseLeaveColumnHeader: function (event) {
                var settings = this.settings;
                var headerCell = $(event.target).closest('div.' + settings.tableClassName + '-header-cell,div.' + settings.cellPreviewClassName)[0];
                headerCell.style.cursor = '';
            },

            /**
             * @private
             * @param {jQuery.Event} event event
             */
            _onClickColumnHeader: function (event) {
                if (!this._getColumnByResizePosition(event)) {
                    var settings = this.settings;
                    var headerCell = $(event.target).closest('div.' + settings.tableClassName + '-header-cell,div.' + settings.cellPreviewClassName)[0];
                    if (settings.sortableColumns) {
                        var column = this._columns.get(headerCell['columnName']);
                        if (column && column.sortable) {
                            this.sort(headerCell['columnName'], undefined, true).render();
                        }
                    }
                }
            },

            /**
             * @private
             * @param {jQuery.Event} event event
             */
            _onStartDragColumnHeader: function (event) {
                var settings = this.settings;
                if (settings.movableColumns) {

                    var $headerCell = $(event.target).closest('div.' + settings.tableClassName + '-header-cell,div.' + settings.cellPreviewClassName);
                    var column = this._columns.get($headerCell[0]['columnName']);
                    if (column && column.movable) {
                        $headerCell[0].style.opacity = 0.35;
                        this._dragId = Math.random() * 0x9999999; // Recognize this ID on drop
                        event.originalEvent.dataTransfer.setData('text', JSON.stringify({dragId: this._dragId, column: column.name}));
                    } else {
                        event.preventDefault();
                    }

                } else {

                    event.preventDefault();

                }

                return undefined;
            },

            /**
             * @private
             * @param {MouseEvent} event event
             */
            _onMouseMoveResizeArea: function (event) {

                var column = this._columns.get(this._$resizer[0]['columnName']);
                var rtl = this._isTableRtl();

                var selectedHeaderCell = column.element,
                    commonAncestor = this._$resizer.parent();
                var posCol = selectedHeaderCell.offset(), posRelative = commonAncestor.offset();
                posRelative.left += parseFloat(commonAncestor.css('border-left-width')) || 0;
                posCol.left -= posRelative.left;
                var resizerWidth = this._$resizer.outerWidth();

                var actualX = event.pageX - posRelative.left;
                var minX = posCol.left;
                if (rtl) {
                    minX += selectedHeaderCell.outerWidth();
                    minX -= Math.ceil((parseFloat(selectedHeaderCell.css('border-right-width')) || 0) / 2);
                    minX -= Math.ceil(resizerWidth / 2);
                    minX -= column.ignoreMin ? 0 : this.settings.minColumnWidth;
                    minX -= this._horizontalPadding(selectedHeaderCell[0]);
                    if (actualX > minX) {
                        actualX = minX;
                    }
                } else {
                    minX += Math.ceil((parseFloat(selectedHeaderCell.css('border-right-width')) || 0) / 2);
                    minX -= Math.ceil(resizerWidth / 2);
                    minX += column.ignoreMin ? 0 : this.settings.minColumnWidth;
                    minX += this._horizontalPadding(selectedHeaderCell[0]);
                    if (actualX < minX) {
                        actualX = minX;
                    }
                }

                this._$resizer.css('left', actualX + 'px');
            },

            /**
             * @private
             * @param {Event} event event
             */
            _onEndDragColumnHeader: function (event) {
                if (!this._$resizer) {
                    event.target.style.opacity = null;
                } else {
                    $(document).off('mousemove.dgtable', this._onMouseMoveResizeAreaBound)
                        .off('mouseup.dgtable', this._onEndDragColumnHeaderBound);

                    var column = this._columns.get(this._$resizer[0]['columnName']);
                    var rtl = this._isTableRtl();

                    var selectedHeaderCell = column.element,
                        commonAncestor = this._$resizer.parent();
                    var posCol = selectedHeaderCell.offset(), posRelative = commonAncestor.offset();
                    posRelative.left += parseFloat(commonAncestor.css('border-left-width')) || 0;
                    posCol.left -= posRelative.left;
                    var resizerWidth = this._$resizer.outerWidth();

                    var actualX = event.pageX - posRelative.left;
                    var baseX = posCol.left, minX = posCol.left;
                    var width = 0;
                    if (rtl) {
                        actualX += this._horizontalPadding(selectedHeaderCell[0]);
                        baseX += selectedHeaderCell.outerWidth();
                        baseX -= Math.ceil((parseFloat(selectedHeaderCell.css('border-right-width')) || 0) / 2);
                        baseX -= Math.ceil(resizerWidth / 2);
                        minX = baseX;
                        minX -= column.ignoreMin ? 0 : this.settings.minColumnWidth;
                        if (actualX > minX) {
                            actualX = minX;
                        }
                        width = baseX - actualX;
                    } else {
                        actualX -= this._horizontalPadding(selectedHeaderCell[0]);
                        baseX += Math.ceil((parseFloat(selectedHeaderCell.css('border-right-width')) || 0) / 2);
                        baseX -= Math.ceil(resizerWidth / 2);
                        minX = baseX;
                        minX += column.ignoreMin ? 0 : this.settings.minColumnWidth;
                        if (actualX < minX) {
                            actualX = minX;
                        }
                        width = actualX - baseX;
                    }

                    this._$resizer.remove();
                    this._$resizer = null;

                    var sizeToSet = width;

                    if (column.widthMode === COLUMN_WIDTH_MODE.RELATIVE) {
                        var detectedWidth = this._calculateWidthAvailableForColumns(),
                            sizeLeft = detectedWidth;

                        for (var i = 0, col; i < this._visibleColumns.length; i++) {
                            col = this._visibleColumns[i];
                            if (col.widthMode != COLUMN_WIDTH_MODE.RELATIVE) {
                                sizeLeft -= col.actualWidth;
                            }
                        }

                        sizeToSet = width / sizeLeft;
                        sizeToSet *= 100;
                        sizeToSet += '%';
                    }

                    this.setColumnWidth(column.name, sizeToSet);
                }
            },

            /**
             * @private
             * @param {jQuery.Event} event event
             */
            _onDragEnterColumnHeader: function (event) {
                var settings = this.settings;
                if (settings.movableColumns) {
                    var dataTransferred = event.originalEvent.dataTransfer.getData('text');
                    if (dataTransferred) {
                        dataTransferred = JSON.parse(dataTransferred);
                    }
                    else {
                        dataTransferred = null; // WebKit does not provide the dataTransfer on dragenter?..
                    }

                    var $headerCell = $(event.target).closest('div.' + settings.tableClassName + '-header-cell,div.' + settings.cellPreviewClassName);
                    if (!dataTransferred ||
                        (this._dragId == dataTransferred.dragId && $headerCell['columnName'] !== dataTransferred.column)) {

                        var column = this._columns.get($headerCell[0]['columnName']);
                        if (column && (column.movable || column != this._visibleColumns[0])) {
                            $($headerCell).addClass('drag-over');
                        }
                    }
                }
            },

            /**
             * @private
             * @param {jQuery.Event} event event
             */
            _onDragOverColumnHeader: function (event) {
                event.preventDefault();
            },

            /**
             * @private
             * @param {jQuery.Event} event event
             */
            _onDragLeaveColumnHeader: function (event) {
                var settings = this.settings;
                var $headerCell = $(event.target).closest('div.' + settings.tableClassName + '-header-cell,div.' + settings.cellPreviewClassName);
                if ( ! $($headerCell[0].firstChild)
                       .has(event.originalEvent.relatedTarget).length ) {
                    $headerCell.removeClass('drag-over');
                }
            },

            /**
             * @private
             * @param {jQuery.Event} event event
             */
            _onDropColumnHeader: function (event) {
                event.preventDefault();
                var settings = this.settings;
                var dataTransferred = JSON.parse(event.originalEvent.dataTransfer.getData('text'));
                var $headerCell = $(event.target).closest('div.' + settings.tableClassName + '-header-cell,div.' + settings.cellPreviewClassName);
                if (settings.movableColumns && dataTransferred.dragId == this._dragId) {
                    var srcColName = dataTransferred.column,
                        destColName = $headerCell[0]['columnName'],
                        srcCol = this._columns.get(srcColName),
                        destCol = this._columns.get(destColName);
                    if (srcCol && destCol && srcCol.movable && (destCol.movable || destCol != this._visibleColumns[0])) {
                        this.moveColumn(srcColName, destColName);
                    }
                }
                $($headerCell).removeClass('drag-over');
            },

            /**
             * @private
             * @returns {DGTable} self
             */
            _clearSortArrows: function () {
                if (this._$table) {
                    var tableClassName = this.settings.tableClassName;
                    var sortedColumns = this._$headerRow.find('>div.' + tableClassName + '-header-cell.sorted');
                    var arrows = sortedColumns.find('>div>.sort-arrow');
                    _.forEach(arrows, _.bind(function(arrow){
                        var col = this._columns.get(arrow.parentNode.parentNode['columnName']);
                        if (col) {
                            col.arrowProposedWidth = 0;
                        }
                    }, this));
                    arrows.remove();
                    sortedColumns.removeClass('sorted').removeClass('desc');
                }
                return this;
            },

            /**
             * @private
             * @param {String} column the name of the sort column
             * @param {Boolean} descending table is sorted descending
             * @returns {DGTable} self
             */
            _showSortArrow: function (column, descending) {

                var col = this._columns.get(column);
                var arrow = createElement('span');
                arrow.className = 'sort-arrow';

				if (col.element) {
					col.element.addClass(descending ? 'sorted desc' : 'sorted');
					col.element[0].firstChild.insertBefore(arrow, col.element[0].firstChild.firstChild);
				}

                if (col.widthMode != COLUMN_WIDTH_MODE.RELATIVE && this.settings.adjustColumnWidthForSortArrow) {
                    col.arrowProposedWidth = arrow.scrollWidth + (parseFloat($(arrow).css('margin-right')) || 0) + (parseFloat($(arrow).css('margin-left')) || 0);
                }

                return this;
            },

            /**
             * @private
             * @param {Number} cellIndex index of the column in the DOM
             * @returns {DGTable} self
             */
            _resizeColumnElements: function (cellIndex) {
                var headerCells = this._$headerRow.find('div.' + this.settings.tableClassName + '-header-cell');
                var col = this._columns.get(headerCells[cellIndex]['columnName']);

                if (col) {
                    headerCells[cellIndex].style.width = (col.actualWidthConsideringScrollbarWidth || col.actualWidth) + 'px';

                    var width = (col.actualWidthConsideringScrollbarWidth || col.actualWidth) + 'px';
                    var tbodyChildren = this._$tbody[0].childNodes;
                    for (var i = 0, count = tbodyChildren.length, headerRow; i < count; i++) {
                        headerRow = tbodyChildren[i];
                        if (headerRow.nodeType !== 1) continue;
                        headerRow.childNodes[cellIndex].style.width = width;
                    }
                }

                return this;
            },

            /**
             * @returns {DGTable} self
             * */
            _destroyHeaderCells: function() {
                if (this._$headerRow) {
					this.trigger('headerrowdestroy', this._headerRow);
                    this._$headerRow.find('div.' + this.settings.tableClassName + '-header-cell').remove();
					this._$headerRow = null;
					this._headerRow = null;
                }
                return this;
            },

            /**
             * @private
             * @returns {DGTable} self
             */
            _renderSkeleton: function () {
                var that = this;

                that._destroyHeaderCells();
                that._currentTouchId = null;

                var settings = this.settings,
                    allowCellPreview = settings.allowCellPreview,
                    allowHeaderCellPreview = settings.allowHeaderCellPreview;

                var tableClassName = settings.tableClassName,
                    headerCellClassName = tableClassName + '-header-cell',
                    header = createElement('div'),
                    $header = $(header),
                    headerRow = createElement('div'),
                    $headerRow = $(headerRow);

                header.className = tableClassName + '-header';
                headerRow.className = tableClassName + '-header-row';

                var ieDragDropHandler;
                if (hasIeDragAndDropBug) {
                    ieDragDropHandler = function(evt) {
                        evt.preventDefault();
                        this.dragDrop();
                        return false;
                    };
                }

                var preventDefault = function (event) { event.preventDefault(); };

                for (var i = 0, column, cell, cellInside, $cell; i < that._visibleColumns.length; i++) {
                    column = that._visibleColumns[i];
                    if (column.visible) {
                        cell = createElement('div');
                        $cell = $(cell);
                        cell.draggable = true;
                        cell.className = headerCellClassName;
                        cell.style.width = column.actualWidth + 'px';
                        if (settings.sortableColumns && column.sortable) {
                            cell.className += ' sortable';
                        }
                        cell['columnName'] = column.name;
						cell.setAttribute('data-column', column.name);
                        cellInside = createElement('div');
                        cellInside.innerHTML = settings.headerCellFormatter(column.label, column.name);
                        cell.appendChild(cellInside);
                        if (allowCellPreview && allowHeaderCellPreview) {
                            this._bindCellHoverIn(cell);
                        }
                        headerRow.appendChild(cell);

                        that._visibleColumns[i].element = $cell;

                        $cell.on('mousedown.dgtable', _.bind(that._onMouseDownColumnHeader, that))
                            .on('mousemove.dgtable', _.bind(that._onMouseMoveColumnHeader, that))
                            .on('mouseup.dgtable', _.bind(that._onMouseUpColumnHeader, that))
                            .on('mouseleave.dgtable', _.bind(that._onMouseLeaveColumnHeader, that))
                            .on('touchstart.dgtable', _.bind(that._onTouchStartColumnHeader, that))
                            .on('dragstart.dgtable', _.bind(that._onStartDragColumnHeader, that))
                            .on('click.dgtable', _.bind(that._onClickColumnHeader, that))
                            .on('contextmenu.dgtable', preventDefault);
                        $(cellInside)
                            .on('dragenter.dgtable', _.bind(that._onDragEnterColumnHeader, that))
                            .on('dragover.dgtable', _.bind(that._onDragOverColumnHeader, that))
                            .on('dragleave.dgtable', _.bind(that._onDragLeaveColumnHeader, that))
                            .on('drop.dgtable', _.bind(that._onDropColumnHeader, that));

                        if (hasIeDragAndDropBug) {
                            $cell.on('selectstart.dgtable', _.bind(ieDragDropHandler, cell));
                        }

                        // Disable these to allow our own context menu events without interruption
                        $cell.css({ '-webkit-touch-callout': 'none', '-webkit-user-select': 'none', '-moz-user-select': 'none', '-ms-user-select': 'none', '-o-user-select': 'none', 'user-select': 'none' });
                    }
                }

                if (this._$header) {
                    this._$header.remove();
                }
                this._$header = $header;
                this._header = header;
                this._$headerRow = $headerRow;
                this._headerRow = headerRow;
                $headerRow.appendTo(this._$header);
                $header.prependTo(this.$el);
				
                this.trigger('headerrowcreate', headerRow);

                if (settings.width == DGTable.Width.SCROLL) {
                    this.el.style.overflow = 'hidden';
                } else {
                    this.el.style.overflow = '';
                }

                if (that._$table && settings.virtualTable) {
                    that._$table.remove();
                    if (that._$tbody) {
                        var rows = that._$tbody[0].childNodes;
                        for (var i = 0, len = rows.length; i < len; i++) {
                            that.trigger('rowdestroy', rows[i]);
                            that._unbindCellEventsForRow(rows[i]);
                        }
                    }
                    that._$table = that._table = that._$tbody = that._tbody = null;
                }

                relativizeElement(that.$el);

                if (!settings.height && settings.virtualTable) {
                    settings.height = this.$el.innerHeight();
                }

                // Calculate virtual row heights
                if (settings.virtualTable && !that._virtualRowHeight) {
                    var createDummyRow = function() {
                        var row = createElement('div'),
                            cell = row.appendChild(createElement('div')),
                            cellInner = cell.appendChild(createElement('div'));
                        row.className = tableClassName + '-row';
                        cell.className = tableClassName + '-cell';
                        cellInner.innerHTML = '0';
                        row.style.visibility = 'hidden';
                        row.style.position = 'absolute';
                        return row;
                    };

                    var $dummyTbody, $dummyWrapper = $('<div>')
                        .addClass(this.className)
                        .css({ 'z-index': -1, 'position': 'absolute', left: '0', top: '-9999px', width: '1px', overflow: 'hidden' })
                        .append(
                        $('<div>').addClass(tableClassName).append(
                            $dummyTbody = $('<div>').addClass(tableClassName + '-body').css('width', 99999)
                        )
                    );

                    $dummyWrapper.appendTo(document.body);

                    var row1 = createDummyRow(), row2 = createDummyRow(), row3 = createDummyRow();
                    $dummyTbody.append(row1, row2, row3);

                    that._virtualRowHeightFirst = $(row1).outerHeight();
                    that._virtualRowHeight = $(row2).outerHeight();
                    that._virtualRowHeightLast = $(row3).outerHeight();
                    that._virtualRowHeightMin = Math.min(Math.min(that._virtualRowHeightFirst, that._virtualRowHeight), that._virtualRowHeightLast);
                    that._virtualRowHeightMax = Math.max(Math.max(that._virtualRowHeightFirst, that._virtualRowHeight), that._virtualRowHeightLast);

                    $dummyWrapper.remove();
                }

                // Create table skeleton
                if (!that._$table) {

                    var fragment = document.createDocumentFragment();
                    var table = createElement('div');
                    var $table = $(table);
                    table.className = settings.tableClassName;

                    if (settings.virtualTable) {
                        table.className += ' virtual';
                    }

                    var tableHeight = (settings.height - $headerRow.outerHeight());
                    if ($table.css('box-sizing') !== 'border-box') {
                        tableHeight -= parseFloat($table.css('border-top-width')) || 0;
                        tableHeight -= parseFloat($table.css('border-bottom-width')) || 0;
                        tableHeight -= parseFloat($table.css('padding-top')) || 0;
                        tableHeight -= parseFloat($table.css('padding-bottom')) || 0;
                    }
                    that._visibleHeight = tableHeight;
                    table.style.height = settings.height ? tableHeight + 'px' : 'auto';
                    table.style.display = 'block';
                    table.style.overflowY = 'auto';
                    table.style.overflowX = settings.width == DGTable.Width.SCROLL ? 'auto' : 'hidden';
                    fragment.appendChild(table);

                    var tbody = createElement('div');
                    var $tbody = $(tbody);
                    tbody.className = settings.tableClassName + '-body';
                    that._table = table;
                    that._tbody = tbody;
                    that._$table = $table;
                    that._$tbody = $tbody;

                    if (settings.virtualTable) {
                        that._virtualVisibleRows = Math.ceil(that._visibleHeight / that._virtualRowHeightMin);
                    }

                    that._calculateVirtualHeight();

                    relativizeElement($tbody);
                    relativizeElement($table);

                    table.appendChild(tbody);
                    that.el.appendChild(fragment);
                }

                return that;
            },

            /**
             * @private
             * @returns {DGTable} self
             */
            _updateLastCellWidthFromScrollbar: function(force) {
                // Calculate scrollbar's width and reduce from lat column's width
                var scrollbarWidth = this._table.offsetWidth - this._table.clientWidth;
                if (scrollbarWidth != this._scrollbarWidth || force) {
                    this._scrollbarWidth = scrollbarWidth;
                    for (var i = 0; i < this._columns.length; i++) {
                        this._columns[i].actualWidthConsideringScrollbarWidth = null;
                    }

                    if (this._scrollbarWidth > 0) {
                        var lastColIndex = this._visibleColumns.length - 1;
                        this._visibleColumns[lastColIndex].actualWidthConsideringScrollbarWidth = this._visibleColumns[lastColIndex].actualWidth - this._scrollbarWidth;
                        var lastColWidth = this._visibleColumns[lastColIndex].actualWidthConsideringScrollbarWidth + 'px';
                        var tbodyChildren = this._tbody.childNodes;
                        for (var i = 0, count = tbodyChildren.length, row; i < count; i++) {
                            row = tbodyChildren[i];
                            if (row.nodeType !== 1) continue;
                            row.childNodes[lastColIndex].style.width = lastColWidth;
                        }

                        this._headerRow.childNodes[lastColIndex].style.width = lastColWidth;
                    }
                }
                return this;
            },

            /**
             * Explicitly set the width of the table based on the sum of the column widths
             * @private
             * @param {boolean} parentSizeMayHaveChanged Parent size may have changed, treat rendering accordingly
             * @returns {DGTable} self
             */
            _updateTableWidth: function (parentSizeMayHaveChanged) {
                var settings = this.settings,
                    width = this._calculateTbodyWidth();
                this._tbody.style.minWidth = width + 'px';
                this._headerRow.style.minWidth = (width + (this._scrollbarWidth || 0)) + 'px';

                this._$table.off('scroll', this._onTableScrolledHorizontallyBound);

                if (settings.width == DGTable.Width.AUTO) {
                    // Update wrapper element's size to full contain the table body
                    this.$el.width(this._$table.width(this._$tbody.outerWidth()).outerWidth());
                } else if (settings.width == DGTable.Width.SCROLL) {

                    if (parentSizeMayHaveChanged) {
                        var lastScrollTop = this._table ? this._table.scrollTop : 0,
                            lastScrollLeft = this._table ? this._table.scrollLeft : 0;

                        // BUGFIX: Relayout before recording the widths
                        webkitRenderBugfix(this.el);

                        this._table.scrollTop = lastScrollTop;
                        this._table.scrollLeft = lastScrollLeft;
                        this._header.scrollLeft = lastScrollLeft;
                    }

                    this._$table.on('scroll', this._onTableScrolledHorizontallyBound);
                }

                return this;
            },

            /**
             * @private
             * @returns {Boolean}
             */
            _isTableRtl: function() {
                return this._$table.css('direction') === 'rtl';
            },

            /**
             * @private
             * @param {Object} column column object
             * @returns {String}
             */
            _serializeColumnWidth: function(column) {
                return column.widthMode === COLUMN_WIDTH_MODE.AUTO ? 'auto' :
                        column.widthMode === COLUMN_WIDTH_MODE.RELATIVE ? column.width * 100 + '%' :
                        column.width;
            },

            /**
             * @private
             * @param {HTMLElement} el
             */
            _cellMouseOverEvent: function(el) {
                var that = this,
                    settings = that.settings;

                this._abortCellPreview = false;

                var elInner = el.firstChild;

                if ((elInner.scrollWidth - elInner.clientWidth > 1) ||
                    (elInner.scrollHeight - elInner.clientHeight > 1)) {

                    that.hideCellPreview();

                    var $el = $(el), $elInner = $(elInner);
                    var div = createElement('div'), $div = $(div);
                    div.innerHTML = el.innerHTML;
                    div.className = settings.cellPreviewClassName;

                    var isHeaderCell = $el.hasClass(settings.tableClassName + '-header-cell');
                    if (isHeaderCell) {
                        div.className += ' header';
                        if ($el.hasClass('sortable')) {
                            div.className += ' sortable';
                        }

                        div.draggable = true;

                        $(div).on('mousedown', _.bind(that._onMouseDownColumnHeader, that))
                            .on('mousemove', _.bind(that._onMouseMoveColumnHeader, that))
                            .on('mouseup', _.bind(that._onMouseUpColumnHeader, that))
                            .on('mouseleave', _.bind(that._onMouseLeaveColumnHeader, that))
                            .on('touchstart', _.bind(that._onTouchStartColumnHeader, that))
                            .on('dragstart', _.bind(that._onStartDragColumnHeader, that))
                            .on('click', _.bind(that._onClickColumnHeader, that))
                            .on('contextmenu.dgtable', function (event) { event.preventDefault(); });
                        $(div.firstChild)
                            .on('dragenter', _.bind(that._onDragEnterColumnHeader, that))
                            .on('dragover', _.bind(that._onDragOverColumnHeader, that))
                            .on('dragleave', _.bind(that._onDragLeaveColumnHeader, that))
                            .on('drop', _.bind(that._onDropColumnHeader, that));

                        if (hasIeDragAndDropBug) {
                            $(div).on('selectstart', _.bind(function(evt) {
                                evt.preventDefault();
                                this.dragDrop();
                                return false;
                            }, div));
                        }
                    }

                    var paddingL = parseFloat($el.css('padding-left')) || 0,
                        paddingR = parseFloat($el.css('padding-right')) || 0,
                        paddingT = parseFloat($el.css('padding-top')) || 0,
                        paddingB = parseFloat($el.css('padding-bottom')) || 0;

                    var requiredWidth = elInner.scrollWidth + el.clientWidth - elInner.offsetWidth;

                    var borderBox = $el.css('boxSizing') === 'border-box';
                    if (borderBox) {
                        requiredWidth -= parseFloat($(el).css('border-left-width')) || 0;
                        requiredWidth -= parseFloat($(el).css('border-right-width')) || 0;
                        $div.css('box-sizing', 'border-box');
                    } else {
                        requiredWidth -= paddingL + paddingR;
                        $div.css({ 'margin-top': parseFloat($(el).css('border-top-width')) || 0 });
                    }

                    if (!that._transparentBgColor1) {
                        // Detect browser's transparent spec
                        var tempDiv = document.createElement('div');
                        tempDiv.style.backgroundColor = 'transparent';
                        that._transparentBgColor1 = $(tempDiv).css('background-color');
                        tempDiv.style.backgroundColor = 'rgba(0,0,0,0)';
                        that._transparentBgColor2 = $(tempDiv).css('background-color');
                    }

	                var css = {
                        'box-sizing': 'content-box',
                        width: requiredWidth + 'px',
                        'min-height': $el.height() + 'px',
                        'padding-left': paddingL,
                        'padding-right': paddingR,
                        'padding-top': paddingT,
                        'padding-bottom': paddingB,
                        overflow: 'hidden',
                        position: 'absolute',
                        zIndex: '-1',
                        left: '0',
                        top: '0',
                        cursor: 'default'
                    };

                    if (css) {
                        var bgColor = $(el).css('background-color');
                        if (bgColor === that._transparentBgColor1 || bgColor === that._transparentBgColor2) {
                            bgColor = $(el.parentNode).css('background-color');
                        }
                        if (bgColor === that._transparentBgColor1 || bgColor === that._transparentBgColor2) {
                            bgColor = '#fff';
                        }
                        css['background-color'] = bgColor;
                    }

                    $div.css(css);

                    that.el.appendChild(div);

                    $(div.firstChild).css({
                        'direction': $elInner.css('direction'),
                        'white-space': $elInner.css('white-space')
                    });

                    if (isHeaderCell) {
                        // Disable these to allow our own context menu events without interruption
                        $div.css({ '-webkit-touch-callout': 'none', '-webkit-user-select': 'none', '-moz-user-select': 'none', '-ms-user-select': 'none', '-o-user-select': 'none', 'user-select': 'none' });
                    }

                    div['rowIndex'] = el.parentNode['rowIndex'];
                    var physicalRowIndex = div['physicalRowIndex'] = el.parentNode['physicalRowIndex'];
                    div['columnName'] = that._visibleColumns[_.indexOf(el.parentNode.childNodes, el)].name;

                    that.trigger('cellpreview', div.firstChild, physicalRowIndex == null ? null : physicalRowIndex, div['columnName'], physicalRowIndex == null ? null : that._rows[physicalRowIndex]);
                    if (this._abortCellPreview) {
						$div.remove();
						return;
					}

                    var $parent = that.$el;
                    var $scrollParent = $parent[0] === window ? $(document) : $parent;
                    
                    var offset = $el.offset();
                    var parentOffset = $parent.offset();
                    var rtl = $el.css('float') === 'right';
                    var prop = rtl ? 'right' : 'left';
                    
                    // Handle RTL, go from the other side
                    if (rtl) {
                        var windowWidth = $(window).width();
                        offset.right = windowWidth - (offset.left + $el.outerWidth());
                        parentOffset.right = windowWidth - (parentOffset.left + $parent.outerWidth());
                    }
                    
                    // If the parent has borders, then it would offset the offset...
                    offset.left -= parseFloat($parent.css('border-left-width')) || 0;
                    offset.right -= parseFloat($parent.css('border-right-width')) || 0;
                    offset.top -= parseFloat($parent.css('border-top-width')) || 0;
                    
                    // Handle border widths of the element being offset
                    offset[prop] += parseFloat($(el).css('border-' + prop + '-width')) || 0;
                    offset.top += parseFloat($(el).css('border-top-width')) || parseFloat($(el).css('border-bottom-width')) || 0;

                    // Subtract offsets to get offset relative to parent
                    offset.left -= parentOffset.left;
                    offset.right -= parentOffset.right;
                    offset.top -= parentOffset.top;
                    
                    // Constrain horizontally
                    var minHorz = 0,
                        maxHorz = $parent - $div.outerWidth();
                    offset[prop] = offset[prop] < minHorz ?
                        minHorz :
                        (offset[prop] > maxHorz ? maxHorz : offset[prop]);

                    // Constrain vertically
					var totalHeight = $el.outerHeight();
					var maxTop = $scrollParent.scrollTop() + $parent.innerHeight() - totalHeight;
					if (offset.top > maxTop) {
						offset.top = Math.max(0, maxTop);
					}
					
                    // Apply css to preview cell
                    var previewCss = {
                        top: offset.top,
                        'z-index': 9999
                    };
                    previewCss[prop] = offset[prop];
                    
                    $div.css(previewCss);

                    div['__cell'] = el;
                    that._$cellPreviewEl = $div;
                    el['__previewEl'] = div;

                    that._bindCellHoverOut(el);
                    that._bindCellHoverOut(div);

                    $div.on('mousewheel', function (event) {
                        var originalEvent = event.originalEvent;
                        var xy = originalEvent.wheelDelta || -originalEvent.detail,
                            x = originalEvent.wheelDeltaX || (originalEvent.axis == 1 ? xy : 0),
                            y = originalEvent.wheelDeltaY || (originalEvent.axis == 2 ? xy : 0);

                        if (xy) {
                            that.hideCellPreview();
                        }

                        if (y && that._table.scrollHeight > that._table.clientHeight) {
                            var scrollTop = (y * -1) + that._$table.scrollTop();
                            that._$table.scrollTop(scrollTop);
                        }

                        if (x && that._table.scrollWidth > that._table.clientWidth) {
                            var scrollLeft = (x * -1) + that._$table.scrollLeft();
                            that._$table.scrollLeft(scrollLeft);
                        }
                    });
                }
            },

            /**
             * @private
             * @param {HTMLElement} el
             */
            _cellMouseOutEvent: function(el) {
                this.hideCellPreview();
            },

            /**
             * Hides the current cell preview,
             * or prevents the one that is currently trying to show (in the 'cellpreview' event)
             * @public
             * @expose
             * @returns {DGTable} self
             */
            hideCellPreview: function() {
                if (this._$cellPreviewEl) {
                    var div = this._$cellPreviewEl[0];
                    this._$cellPreviewEl.remove();
                    this._unbindCellHoverOut(div['__cell']);
                    this._unbindCellHoverOut(div);

                    div['__cell']['__previewEl'] = null;
                    div['__cell'] = null;

                    this.trigger('cellpreviewdestroy', div.firstChild, div['physicalRowIndex'], div['columnName']);

                    this._$cellPreviewEl = null;
                }
                this._abortCellPreview = false;
                return this;
            }
        }
    );

    // It's a shame the Google Closure Compiler does not support exposing a nested @param

    /**
     * @typedef SERIALIZED_COLUMN
     * */
    var SERIALIZED_COLUMN = {
        /**
         * @expose
         * @const
         * @type {Number}
         * */
        order: 0,

        /**
         * @expose
         * @const
         * @type {String}
         * */
        width: 'auto',

        /**
         * @expose
         * @const
         * @type {Boolean}
         * */
        visible: true
    };

    /**
     * @typedef SERIALIZED_COLUMN_SORT
     * */
    var SERIALIZED_COLUMN_SORT = {
        /**
         * @expose
         * @const
         * @type {String}
         * */
        column: '',

        /**
         * @expose
         * @const
         * @type {Boolean}
         * */
        descending: false
    };

    /**
     * @typedef COLUMN_WIDTH_MODE
     * */
    var COLUMN_WIDTH_MODE = {
        /** 
         * @expose
         * @const
         * @type {Number}
         * */
        AUTO: 0,
        
        /** 
         * @expose
         * @const
         * @type {Number}
         * */
        ABSOLUTE: 1,
        
        /** 
         * @expose
         * @const
         * @type {Number}
         * */
        RELATIVE: 2
    };

    /**
     * @typedef DGTable.Width
     * @expose
     * */
    DGTable.Width = {
        /**
         * @expose
         * @const
         * @type {String}
         * */
        NONE: 'none',

        /**
         * @expose
         * @const
         * @type {String}
         * */
        AUTO: 'auto',

        /**
         * @expose
         * @const
         * @type {String}
         * */
        SCROLL: 'SCROLL'
    };

    /**
     * @typedef COLUMN_SORT_OPTIONS
     * */
    var COLUMN_SORT_OPTIONS = {
        /**
         * @expose
         * @type {String}
         * */
        column: null,
        
        /**
         * @expose
         * @type {Boolean=false}
         * */
        descending: null
    };

    /**
     * @typedef COLUMN_OPTIONS
     * */
    var COLUMN_OPTIONS = {
        /**
         * @expose
         * @type {String}
         * */
        name: null,
        
        /**
         * @expose
         * @type {String=name}
         * */
        label: null,
        
        /**
         * @expose
         * @type {String=name}
         * */
        dataPath: null,
        
        /**
         * @expose
         * @type {String=dataPath}
         * */
        comparePath: null,
        
        /**
         * @expose
         * @type {Number|String}
         * */
        width: null,
        
        /**
         * @expose
         * @type {Boolean=true}
         * */
        resizable: null,
        
        /**
         * @expose
         * @type {Boolean=true}
         * */
        movable: null,
        
        /**
         * @expose
         * @type {Boolean=true}
         * */
        sortable: null,
        
        /**
         * @expose
         * @type {Boolean=true}
         * */
        visible: null,
        
        /**
         * @expose
         * @type {String}
         * */
        cellClasses: null,
        
        /**
         * @expose
         * @type {Boolean=false}
         * */
        ignoreMin: null
    };

    /**
     * @typedef INIT_OPTIONS
     * @param {COLUMN_OPTIONS[]} columns
     * @param {Number} height
     * @param {DGTable.Width} width
     * @param {Boolean=true} virtualTable
     * @param {Boolean=true} resizableColumns
     * @param {Boolean=true} movableColumns
     * @param {Number=1} sortableColumns
     * @param {Boolean=true} adjustColumnWidthForSortArrow
     * @param {Boolean=true} relativeWidthGrowsToFillWidth
     * @param {Boolean=false} relativeWidthShrinksToFillWidth
     * @param {Boolean=false} convertColumnWidthsToRelative
     * @param {String} cellClasses
     * @param {String|String[]|COLUMN_SORT_OPTIONS|COLUMN_SORT_OPTIONS[]} sortColumn
     * @param {Function?} cellFormatter
     * @param {Function?} headerCellFormatter
     * @param {Number=10} rowsBufferSize
     * @param {Number=35} minColumnWidth
     * @param {Number=8} resizeAreaWidth
     * @param {Function(String,Boolean)Function(a,b)Boolean} comparatorCallback
     * @param {String?} resizerClassName
     * @param {String?} tableClassName
     * @param {Boolean=true} allowCellPreview
     * @param {String?} cellPreviewClassName
     * @param {Boolean=true} cellPreviewAutoBackground
     * @param {String?} className
     * @param {String?} tagName
     * */
    var INIT_OPTIONS = {
        /**
         * @expose
         * @type {COLUMN_OPTIONS[]}
         * */
        columns: null,

        /** @expose */
        height: null,

        /**
         * @expose
         * @type {DGTable.Width}
         * */
        width: null,

        /** @expose */
        virtualTable: null,

        /** @expose */
        resizableColumns: null,

        /** @expose */
        movableColumns: null,

        /** @expose */
        sortableColumns: null,

        /**
         * @expose
         * @type {Boolean=true}
         * */
        adjustColumnWidthForSortArrow: null,

        /** @expose */
        cellClasses: null,

        /** @expose */
        sortColumn: null,

        /** @expose */
        cellFormatter: null,

        /** @expose */
        headerCellFormatter: null,

        /** @expose */
        rowsBufferSize: null,

        /** @expose */
        minColumnWidth: null,

        /** @expose */
        resizeAreaWidth: null,

        /** @expose */
        comparatorCallback: null,

        /**
         * @expose
         * @type {Boolean=true}
         * */
        relativeWidthGrowsToFillWidth: null,

        /**
         * @expose
         * @type {Boolean=false}
         * */
        relativeWidthShrinksToFillWidth: null,

        /**
         * @expose
         * @type {Boolean=false}
         * */
        convertColumnWidthsToRelative: null,

        /**
         * @expose
         * @type {String}
         * */
        resizerClassName: null,

        /**
         * @expose
         * @type {String}
         * */
        tableClassName: null,

        /**
         * @expose
         * @type {Boolean}
         * */
        allowCellPreview: null,

        /**
         * @expose
         * @type {Boolean}
         * */
        allowHeaderCellPreview: null,

        /**
         * @expose
         * @type {String}
         * */
        cellPreviewClassName: null,

        /**
         * @expose
         * @type {Boolean}
         * */
        cellPreviewAutoBackground: null,

        /** @expose */
        className: null,

        /** @expose */
        tagName: null
    };

    /**
     * @typedef {{
     *  currentTarget: Element,
     *  data: Object.<string, *>,
     *  delegateTarget: Element,
     *  isDefaultPrevented: Boolean,
     *  isImmediatePropagationStopped: Boolean,
     *  isPropagationStopped: Boolean,
     *  namespace: string,
     *  originalEvent: Event,
     *  pageX: Number,
     *  pageY: Number,
     *  preventDefault: Function,
     *  props: Object.<string, *>,
     *  relatedTarget: Element,
     *  result: *,
     *  stopImmediatePropagation: Function,
     *  stopPropagation: Function,
     *  target: Element,
     *  timeStamp: Number,
     *  type: string,
     *  which: Number
     * }} jQuery.Event
     * */

    /** @expose */
    global.DGTable = DGTable;

})(this, jQuery);

/*
The MIT License (MIT)

Copyright (c) 2014 Daniel Cohen Gindi (danielgindi@gmail.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
/* global DGTable, _ */
DGTable.ColumnCollection = (function () {
    'use strict';

    // Define class RowCollection
    var ColumnCollection = function() {

        // Instantiate an Array. Seems like the `.length = ` of an inherited Array does not work well.
        // I will not use the IFRAME solution either in fear of memory leaks, and we're supporting large datasets...
        var collection = [];

        // Synthetically set the 'prototype'
        _.extend(collection, ColumnCollection.prototype);

        // Call initializer
        collection.initialize.apply(collection, arguments);

        return collection;
    };

    // Inherit Array
    ColumnCollection.prototype = [];

    ColumnCollection.prototype.initialize = function() {

    };

    /**
     * Get the column by this name
     * @param {String} column column name
     * @returns {Object} the column object
     */
    ColumnCollection.prototype.get = function(column) {
        for (var i = 0, len = this.length; i < len; i++) {
            if (this[i].name == column) {
                return this[i];
            }
        }
        return null;
    };

    /**
     * Get the index of the column by this name
     * @param {String} column column name
     * @returns {int} the index of this column
     */
    ColumnCollection.prototype.indexOf = function(column) {
        for (var i = 0, len = this.length; i < len; i++) {
            if (this[i].name == column) {
                return i;
            }
        }
        return -1;
    };

    /**
     * Get the column by the specified order
     * @param {Number} order the column's order
     * @returns {Object} the column object
     */
    ColumnCollection.prototype.getByOrder = function(order) {
        for (var i = 0, len = this.length; i < len; i++) {
            if (this[i].order == order) {
                return this[i];
            }
        }
        return null;
    };

    /**
     * Normalize order
     * @returns {ColumnCollection} self
     */
    ColumnCollection.prototype.normalizeOrder = function() {
        var ordered = [], i;
        for (i = 0; i < this.length; i++) {
            ordered.push(this[i]);
        }
        ordered.sort(function(col1, col2){ return col1.order < col2.order ? -1 : (col1.order > col2.order ? 1 : 0); });
        for (i = 0; i < ordered.length; i++) {
            ordered[i].order = i;
        }
        return this;
    };

    /**
     * Get the array of visible columns, order by the order property
     * @returns {Array<Object>} ordered array of visible columns
     */
    ColumnCollection.prototype.getVisibleColumns = function() {
        var visible = [];
        for (var i = 0, column; i < this.length; i++) {
            column = this[i];
            if (column.visible) {
                visible.push(column);
            }
        }
        visible.sort(function(col1, col2){ return col1.order < col2.order ? -1 : (col1.order > col2.order ? 1 : 0); });
        return visible;
    };

    /**
     * @returns {int} maximum order currently in the array
     */
    ColumnCollection.prototype.getMaxOrder = function() {
        var order = 0;
        for (var i = 0, column; i < this.length; i++) {
            column = this[i];
            if (column.order > order) {
                order = column.order;
            }
        }
        return order;
    };

    /**
     * Move a column to a new spot in the collection
     * @param {Object} src the column to move
     * @param {Object} dest the destination column
     * @returns {DGTable.ColumnCollection} self
     */
    ColumnCollection.prototype.moveColumn = function (src, dest) {
        if (src && dest) {
            var srcOrder = src.order, destOrder = dest.order, i, col;
            if (srcOrder < destOrder) {
                for (i = srcOrder + 1; i <= destOrder; i++) {
                    col = this.getByOrder(i);
                    col.order--;
                }
            } else {
                for (i = srcOrder - 1; i >= destOrder; i--) {
                    col = this.getByOrder(i);
                    col.order++;
                }
            }
            src.order = destOrder;
        }
        return this;
    };

    return ColumnCollection;

})();
/*
The MIT License (MIT)

Copyright (c) 2014 Daniel Cohen Gindi (danielgindi@gmail.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
/* global DGTable, _, Backbone */
DGTable.RowCollection = (function () {
    'use strict';

    // Define class RowCollection
    var RowCollection = function() {

        // Instantiate an Array. Seems like the `.length = ` of an inherited Array does not work well.
        // I will not use the IFRAME solution either in fear of memory leaks, and we're supporting large datasets...
        var collection = [];

        // Synthetically set the 'prototype'
        _.extend(collection, RowCollection.prototype);

        // Call initializer
        collection.initialize.apply(collection, arguments);

        return collection;
    };

    // Inherit Array
    RowCollection.prototype = [];

    // Add events model from Backbone
    _.extend(RowCollection.prototype, Backbone.Events);

    RowCollection.prototype.initialize = function(options) {

        options = options || {};

        /** @field {String} filterColumn */
        this.filterColumn = null;

        /** @field {String} filterString */
        this.filterString = null;

        /** @field {Boolean} filterCaseSensitive */
        this.filterCaseSensitive = false;

        /** @field {string} sortColumn */
        this.sortColumn = options.sortColumn == null ? [] : options.sortColumn;
    };

    /**
     * @param {Object|Object[]} rows Row or array of rows to add to this collection
     * @param {number?} at Position to insert rows. This will prevent the sort if it is active.
     */
    RowCollection.prototype.add = function (rows, at) {
        var isArray = ('splice' in rows && 'length' in rows), i, len;
        if (isArray) {
            if (at) {
                for (i = 0, len = rows.length; i < len; i++) {
                    this.splice(at++, 0, rows[i]);
                }
            } else {
                for (i = 0, len = rows.length; i < len; i++) {
                    this.push(rows[i]);
                }
            }
        } else {
            if (at) {
                this.splice(at, 0, rows);
            } else {
                this.push(rows);
            }
        }
    };

    /**
     * @param {Object|Object[]=} rows Row or array of rows to add to this collection
     */
    RowCollection.prototype.reset = function (rows) {
        this.length = 0;
        if (rows) {
            this.add(rows);
        }
    };

    /**
     * @param {string} columnName name of the column to filter on
     * @param {string} filter keyword to filter by
     * @param {boolean=false} caseSensitive is the filter case sensitive?
     * @returns {DGTable.RowCollection} success result
     */
    RowCollection.prototype.filteredCollection = function (columnName, filter, caseSensitive) {
        filter = filter.toString();
        if (filter && columnName != null) {
            var rows = new RowCollection({ sortColumn: this.sortColumn });
            this.filterColumn = columnName;
            this.filterString = filter;
            this.filterCaseSensitive = caseSensitive;
            for (var i = 0, len = this.length, row; i < len; i++) {
                row = this[i];
                if (this.shouldBeVisible(row)) {
                    row['__i'] = i;
                    rows.push(row);
                }
            }
            return rows;
        } else {
            this.filterColumn = null;
            this.filterString = null;
            return null;
        }
    };

    /**
     * @param {Array} row
     * @returns {boolean}
     */
    RowCollection.prototype.shouldBeVisible = function (row) {
        if (row && this.filterColumn) {
            var actualVal = row[this.filterColumn];
            if (actualVal == null) {
                return false;
            }
            actualVal = actualVal.toString();
            var filterVal = this.filterString;
            if (!this.filterCaseSensitive) {
                actualVal = actualVal.toUpperCase();
                filterVal = filterVal.toUpperCase();
            }
            return actualVal.indexOf(filterVal) !== -1;
        }
        return true;
    };

    (function(){
        var nativeSort = RowCollection.prototype.sort;

        function getDefaultComparator(column, descending) {
            var columnName = column.column;
            var comparePath = column.comparePath || columnName;
            if (typeof comparePath === 'string') {
                comparePath = comparePath.split('.');
            }
            var pathLength = comparePath.length,
                hasPath = pathLength > 1,
                i;
            
            var lessVal = descending ? 1 : -1, moreVal = descending ? -1 : 1;
            return function(leftRow, rightRow) {
                var leftVal = leftRow[comparePath[0]],
                    rightVal = rightRow[comparePath[0]];
                if (hasPath) {
                    for (i = 1; i < pathLength; i++) {
                        leftVal = leftVal && leftVal[comparePath[i]];
                        rightVal = rightVal && rightVal[comparePath[i]];
                    }
                }
                return leftVal < rightVal ? lessVal : (leftVal > rightVal ? moreVal : 0);
            };
        }

        /**
         * @param {Boolean=false} silent
         * @returns {DGTable.RowCollection} self
         */
        RowCollection.prototype.sort = function (silent) {
            if (this.sortColumn.length) {
                var comparators = [], i, returnVal;
                
                for (i = 0; i < this.sortColumn.length; i++) {
                    returnVal = {};
                    this.trigger('requiresComparatorForColumn', returnVal, this.sortColumn[i].column, this.sortColumn[i].descending);
                    comparators.push(_.bind(returnVal.comparator || getDefaultComparator(this.sortColumn[i], this.sortColumn[i].descending), this));
                }
                
                if (comparators.length === 1) {
                    nativeSort.call(this, comparators[0]);
                } else {
                    var len = comparators.length,
                        value,
                        comparator = function(leftRow, rightRow) {
                            for (i = 0; i < len; i++) {
                                value = comparators[i](leftRow, rightRow);
                                if (value !== 0) {
                                    return value;
                                }
                            }
                            return value;
                        };
                    nativeSort.call(this, comparator);
                }

                if (!silent) {
                    this.trigger('sort');
                }
            }
            return this;
        };
    })();

    return RowCollection;

})();