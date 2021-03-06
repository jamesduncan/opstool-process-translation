
steal(
    'opstools/ProcessTranslation/models/TRRequest.js',
    function () {
		System.import('appdev').then(function () {
			steal.import(
				'appdev/control/control',
				'appdev/model/model',
				'OpsPortal/classes/OpsWidget'
				).then(function () {
					
					// Namespacing conventions:
					// AD.Control.extend('[application].[controller]', [{ static },] {instance} );
					AD.Control.extend('opstools.ProcessTranslation.PendingTransactions', {


						init: function (element, options) {
							var self = this;
							options = AD.defaults({
								eventItemSelected: 'TR_Transaction.Selected'
							}, options);
							this.options = options;

							// Call parent init
							this._super(element, options);

							this.dataSource = this.options.dataSource; // AD.models.Projects;

							this.data = new can.Map({
								listTransactions: new can.List([]),
								selectedItem: null
							});

							this.initDOM();
							this.initModel();
						},

						initDOM: function () {
							// keep a reference to our list area:
							this.dom = {};
							this.dom.list = this.element.find('ul.op-list');

							var template = this.domToTemplate(this.dom.list);
							can.view.ejs('PendingTranslateTransactions_List', template);

							this.dom.list.html(can.view('PendingTranslateTransactions_List', { data: this.data }));

							this.dom.ListWidget = new AD.op.Widget(this.element);
						},

						initModel: function () {
							var _this = this;
							// now get access to the TRRequest Model:
							this.TRRequest = AD.Model.get('opstools.ProcessTranslation.TRRequest');

							// listen for updates to any of our TRRequest models:
							this.TRRequest.bind('updated', function (ev, request) {

								// only do something if this is no longer 'pending'
								if (request.status != 'pending') {

									// verify this request is in our displayed list
									var atIndex = _this.data.listTransactions.indexOf(request);
									if (atIndex > -1) {

										// if so, remove the entry.
										_this.data.listTransactions.splice(atIndex, 1);


										// decide which remaining element we want to click:
										var clickIndx = atIndex;  // choose next one if there.
										if (_this.data.listTransactions.attr('length') <= clickIndx) {

											// not enough entries, so choose the last one then:
											clickIndx = _this.data.listTransactions.attr('length') - 1;

										}

										// if there is one to select
										if (clickIndx >= 0) {

											// get that LI item:
											var allLIs = _this.element.find('li');
											var indexLI = allLIs[clickIndx];

											// now select this LI:
											_this.selectLI($(indexLI));

										}

									}
								}
							});
                
							// Lock/Unlock pending items 
							this.TRRequest.on('messaged', function (ev, data) {
								var foundEL = _this.element.find('[trrequest-id="' + data.id + '"]');
								if (data.data.locked) {
									foundEL.addClass('trrequest-locked');
								} else {
									foundEL.removeClass('trrequest-locked');
								}
							});
						},

						setList: function (list) {
							var _this = this;

							this.data.attr('listTransactions', list);
                    
							// Unable selected items
							this.TRRequest.wholock(function (err, result) {
								if (err) return;

								result.forEach(function (lockedId) {
									if (_this.data.selectedItem) {
										if (_this.data.selectedItem.getID() !== lockedId) {
											var foundEL = _this.element.find('[trrequest-id="' + lockedId + '"]');
											foundEL.addClass('trrequest-locked');
										}
									} else {
										var foundEL = _this.element.find('[trrequest-id="' + lockedId + '"]');
										foundEL.addClass('trrequest-locked');
									}
								});
							});

							if (this.data.screenHeight) {
								this.resize(this.data.screenHeight);
							}
						},

						resize: function (height) {
							this.data.screenHeight = height;

							if (this.dom.ListWidget) {
								this.dom.ListWidget.resize({ height: height });
							}
						},

						selectLI: function ($el) {
							this.clearSelectItems();

							$el.addClass('active');

							var model = $el.data('item');
							this.data.selectedItem = model;

							// lock the newly selected model:
							this.data.selectedItem.lock();

							this.element.trigger(this.options.eventItemSelected, model);
						},

						updateTransaction: function (transaction) {
							this.data.listTransactions.forEach(function (tran) {
								if (tran.id === transaction.id) {
									tran.objectData.form.data.fromLanguage = transaction.objectData.form.data.fromLanguage;
									tran.objectData.form.data.toLanguage = transaction.objectData.form.data.toLanguage;
									return;
								}
							});

							this.setList(this.data.listTransactions);
						},

						clearSelectItems: function () {
							if (this.data.selectedItem) {
								this.data.selectedItem.unlock();
								this.data.selectedItem = null;
							}

							this.element.find('.active').removeClass('active');
						},

						'li click': function ($el, ev) {
							if (!$el.hasClass('trrequest-locked') && !$el.hasClass('active')) {
								this.selectLI($el);
							}

							ev.preventDefault();
						}
					});
				});
		});

	});