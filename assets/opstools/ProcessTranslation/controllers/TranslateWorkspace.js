
steal(
    function() {
		System.import('appdev').then(function() {
			steal.import(
				'appdev/ad',
				'appdev/control/control',
				'OpsPortal/classes/OpsButtonBusy',
				'OpsPortal/classes/OpsWidget').then(function() {
					// Namespacing conventions:
					// AD.Control.extend('[application].[controller]', [{ static },] {instance} );
					AD.Control.extend('opstools.ProcessTranslation.TranslateWorkspace', {

						init: function(element, options) {
							var self = this;
							options = AD.defaults({
								eventItemAccepted: 'TR_Transaction.Accepted',
								eventPopulateFinished: 'TR_Transaction.Finished'
							}, options);
							this.options = options;

							// Call parent init
							this._super(element, options);

							this.TRRequest = AD.Model.get('opstools.ProcessTranslation.TRRequest');
							this.dataSource = this.options.dataSource; // AD.models.Projects;

							this.transaction = null;
							this.buttons = {};
							this.data = {};
							this.data.languageData = new can.Map({});

							this.initDOM();
						},

						initDOM: function() {
							this.dom = {};

							var template = this.domToTemplate(this.element);
							can.view.ejs('TR_TranslateForm', template);

							this.element.html(can.view('TR_TranslateForm', {}));
						},

						setTransaction: function(transaction, fromLanguageCode, toLanguageCode) {
							var _this = this;
							this.transaction = transaction;

							// Get TRlive
							this.transaction.getLiveTrData(function(err, data) {
								for (var fieldName in data) {
									if (fieldName === 'id')
										continue;

									var liveData = data[fieldName];

									for (var languageCode in liveData) {
										transaction.objectData.form.data.fields[fieldName].attr(languageCode, liveData[languageCode]);
									}
								}
							});

							// Popuplate empty labels
							if (!transaction.objectData.form.data.labels)
								transaction.objectData.form.data.labels = {};

							for (var fieldName in transaction.objectData.form.data.fields) {
								if (!transaction.objectData.form.data.labels[fieldName]) {
									transaction.objectData.form.data.labels[fieldName] = {};
									transaction.objectData.form.data.labels[fieldName][fromLanguageCode] = '';
									transaction.objectData.form.data.labels[fieldName][toLanguageCode] = '';
								}
							}

							this.data.languageData.attr('fromLanguageCode', fromLanguageCode);
							this.data.languageData.attr('toLanguageCode', toLanguageCode);

							this.element.html(can.view('TR_TranslateForm', { transaction: transaction, data: transaction.objectData.form.data, languageData: this.data.languageData }));
							this.element.find('.tr-instructionsPanel').hide();
							this.element.find('.tr-translateform-panel').show();
							this.element.find('.tr-translateform-submit').each(function(index, btn) {
								var status = $(btn).attr('tr-status');
								_this.buttons[status] = new AD.op.ButtonBusy(btn);
							});

							this.embeddTemplate('.tr-optionalinfo', transaction.objectData.form);
							this.form = new AD.op.Form(this.element.find('.tr-translateform'));
							this.dom.FormWidget = new AD.op.Widget(this.element.find('.tr-translate-body'));
							if (this.data.screenHeight)
								this.resize(this.data.screenHeight);
								
							this.element.trigger(this.options.eventPopulateFinished);
						},

						embeddTemplate: function(sel, templateInfo) {
							if (!templateInfo.view || !templateInfo.data.optionalInfo)
								return;

							var $el = this.element.find(sel);

							// #fix: new Steal + CanJS path differences:
							// make sure path is relative from root:
							//   path:  /path/to/view.ejs
							// so make sure has beginning '/'
							if (templateInfo.view[0] != '/') {
								templateInfo.view = '/' + templateInfo.view;
							} else {

								// and not '//':
								if (templateInfo.view[1] == '/') {
									templateInfo.view = templateInfo.view.replace('//', '/');
								}
							}


							try {
								// $el.html(can.view(templateInfo.view, { data: templateInfo.data.optionalInfo }));
								can.view(templateInfo.view, { data: templateInfo.data.optionalInfo }, function(frag) {
									$el.html(frag);

									// attach any embed op images
									$el.find('[ap-op-image]').each(function(i, el){
										new AD.op.Image(el);
									});
								});

							} catch (e) {
								// This is most likely a template reference error.
								AD.error.log('Error displaying template:' + templateInfo.view, { error: e });

								var errorDisplay = [
									'Error displaying provided object template (' + templateInfo.view + ')',
									'Here is the raw data:'
								];

								for (var f in templateInfo.data.fields.attr()) {
									errorDisplay.push(f + ' : ' + templateInfo.data.fields[f]);
								}

								$el.html(errorDisplay.join('<br>'));
							}
						},

						setFromLanguageCode: function(fromLanguageCode) {
							this.data.languageData.attr('fromLanguageCode', fromLanguageCode);
						},

						clearWorkspace: function() {
							this.transaction = null;
							this.element.find('.tr-translateform').html('');
							this.element.find('.tr-translateform-panel').hide();
							this.element.find('.tr-instructionsPanel').show();
						},

						buttonsEnable: function() {
							for (var b in this.buttons) {
								if (this.buttons[b])
									this.buttons[b].enable();
							}
						},

						buttonsDisable: function() {
							for (var b in this.buttons) {
								if (this.buttons[b])
									this.buttons[b].disable();
							}
						},

						populateTransactionToNewValues: function() {

							// save form values to the object
							var formValues = this.form.values();
							for (var key in formValues) {
								if (key.indexOf('.')) {
									var fieldName = key.split('.')[0];
									var languageCode = key.split('.')[1];

									this.transaction.objectData.form.data.fields[fieldName].attr(languageCode, formValues[key]);
								}
							}
						},

						resize: function(height) {
							this.data.screenHeight = height;

							if (this.dom.FormWidget) {
								this.dom.FormWidget.resize({ height: height - 232 });
							}
						},

						'.tr-translateform-submit click': function($btn) {
							var _this = this;

							var status = $btn.attr('tr-status');

							this.buttonsDisable();
							this.buttons[status].busy();

							switch (status) {
								case 'accept':
									// TODO : confirm box ??

									this.populateTransactionToNewValues();
									this.transaction.attr('status', 'processed');
									this.transaction.save().then(function() {
										_this.clearWorkspace();

										_this.element.trigger(_this.options.eventItemAccepted, _this.transaction);

										_this.buttons[status].ready();
										_this.buttonsEnable();
									});
									break;
								case 'save':
									this.populateTransactionToNewValues();
									this.transaction.save().then(function() {
										_this.buttons[status].ready();
										_this.buttonsEnable();
									});
									break;
								case 'cancel':
									AD.op.Dialog.Confirm({
										fnYes: function() {
											_this.setTransaction(_this.transaction, _this.data.languageData.attr('fromLanguageCode'), _this.data.languageData.attr('toLanguageCode'));
											_this.buttons[status].ready();
											_this.buttonsEnable();
										},
										fnNo: function() {
											_this.buttons[status].ready();
											_this.buttonsEnable();
										}
									});
									break;
								default:
									this.buttons[status].ready();
									this.buttonsEnable();
									break;
							}
						}

					});
				});
		});
	});