(function($) {

    $(document).ready(function() {

        function checkAllFields() {
            var els = $(this).closest('.user-form').find('.form-control').get();
            var allFilled = els.every(function(el) {
                return !!$(el).val();
            });
            return allFilled;
        }


        function invalidForm(el, text) {
            if (!el.next()[0]) {
                $('<span/>', {
                    'class': 'help-block',
                    'id': 'help' + el.attr('id'),
                    'text': text,
                }).appendTo(el.parent()).slideDown('fast');
            }
            if (!$('.form-submit-btn').prop('disabled')) $('.form-submit-btn').prop('disabled', true);
            el.parent().removeClass('has-success').addClass('has-error');
        }

        function validForm(el) {
            if (el.next().hasClass('help-block')) {
                el.next().slideUp('fast').remove();
            }
            el.parent().removeClass('has-error').addClass('has-success');
            if (checkAllFields() && $('.form-submit-btn').prop('disabled') === true) {
                $('.form-submit-btn').prop('disabled', false);
            }
        }

        function invalidPass(str) {
            return /^(.{0,9}|[^0-9]*|[^A-Z]*|[^a-z]*|[a-zA-Z0-9]*)$/.test(str);
        }



        function checkEmail(el, val) {
            $.getJSON('/emailcheck/' + encodeURIComponent(val), function(data) {
                if (data.validity === true) {
                    $('#emailchecked').prop('checked', true);
                    validForm(el);
                } else {
                    invalidForm(el,
                        data.message === 'user already exists' ? 'This email address already has an account already attached to it' : 'This email address is invalid');
                    $('#emailchecked').prop('checked', false);
                }
            }).fail(function(err) {
                console.log('Unable to successfully run email check.');
                validForm(el);
                $('#emailchecked').prop('checked', true);
            });
        }

        if (window.location.pathname === '/settings' && !!window.location.hash) {
            if (window.location.hash !== '#changepassword') {
                $('.settings-tabs-tab-link[href="#changepassword"]').parent().removeClass('active');
                $('.settings-tabs-tab-link[href="' + window.location.hash + '"]').parent().addClass('active');
                $("#changepassword").removeClass('active');
                $(window.location.hash).addClass('active');
            }
        }

        if (!!$('.form-control').length) {
            $('.form-submit-btn').prop('disabled', true);
        }

        $('.user-form').on('submit', function(e) {
            if (!!$(this).find('.userinfo').val() || ($('.form-submit-btn').length && $('.form-submit-btn').prop('disabled') === true)) {
                e.preventDefault();
                return false;
            } else {
                return true;
            }
        });

        $('.form-control:not([type=password])').on('blur', function(e) {
            var str;
            var curr = $(this);
            var currVal = curr.val();
            var currType = curr.attr('type');
            var currId = curr.attr('id');
            var isConfirm = !!~currId.indexOf('confirm');


            if (!!currVal && currType === 'email' && (!!$('#registerform').length || currId === 'newemail')) {
                checkEmail(curr, currVal);
            } else if (!currVal || (isConfirm && (currVal !== $('#' + currId.slice(7).trim()).val()))) {
                str = isConfirm ? ('Matching ' + currType) : currType.substr(0, 1).toUpperCase() + currType.slice(1);
                str += ' is required';
                invalidForm(curr, str);
            } else if (!!~currId.indexOf('new') && !!$('[id^=old]').length && $('[id^=old]').val() === currVal) {
                invalidForm(curr, 'Unique values are required');
            } else {
                validForm(curr);
            }
        });

        $('.form-control[type=password]').on('keyup', function(e) {
            var str;
            var curr = $(this);
            var currVal = curr.val();
            var currType = curr.attr('type');
            var currId = curr.attr('id');
            var isConfirm = !!~curr.attr('id').indexOf('confirm');

            if (invalidPass(currVal)) {
                invalidForm(curr, 'Valid password is required');
            } else if (isConfirm && (currVal !== $('#' + currId.slice(7).trim()).val())) {
                str = isConfirm ? ('Matching ' + currType) : currType.substr(0, 1) + currType.slice(1);
                str += ' is required';
                invalidForm(curr, str);
            } else if (!!~currId.indexOf('new') && !!$('[id^=old]').length && $('[id^=old]').val() === currVal) {
                invalidForm(curr, 'Unique values are required');
            } else {
                validForm(curr);
            }
        });




        $('#apiform').on('submit', function(e) {
            e.preventDefault();

            if ($('#key').val() === '') {
                $('#key').focus();
            } else {
                var url = $('#apiform input')
                    .filter(function() {
                        return !!this.value;
                    })
                    .serialize();

                $.getJSON('/api/v1/?' + url, function(data) {
                    $('#apitext').text(JSON.stringify(data, null, 3));
                }).fail(function(err) {
                    console.log('Error with receiving AJAX request.');
                    $('#apitext').text(err.status + ' Error with receiving AJAX request.');
                });
            }
        });



        $('#generatekeyform').on('submit', function(e) {
            e.preventDefault();
            $.post('/generatekey', function(data) {
                $('#keytext').text(data);
            })
                .fail(function(err) {
                    console.log('Unable to generate new key.');
                    $('#keytext').text('Sorry, there\'s been an error with generating a new key.');
                });
        });

    });
})(jQuery);